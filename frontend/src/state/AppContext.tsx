import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { translate, type Language } from '../i18n/translations';
import { fetchPreQuiz, fetchQuiz, streamSummary } from '../lib/api';
import { readPdf } from '../lib/pdf';
import { encodeImageBase64 } from '../lib/image';
import { parseJSON } from '../lib/parseJSON';
import { _sumExtractPartial } from '../lib/summaryStream';
import { validateQuestions } from '../lib/quiz';
import type { Question, StreamingPartial, SummaryData, Truncation } from '../lib/types';

export type ScreenName =
  | 'home'
  | 'upload'
  | 'loading'
  | 'prequiz'
  | 'summary'
  | 'quiz'
  | 'compare';

const FADE = 180; // ms — matches index.html showScreen()

interface Contract {
  fileName: string;
  /** Contract text, one image data URL, or several (pages of a scanned PDF). */
  content: string | string[];
  isImage: boolean;
  /** Set when the contract was too long to analyze in full. */
  truncation: Truncation | null;
}

interface AppState {
  // screen / fade
  screen: ScreenName;
  screenVisible: boolean;
  showScreen: (name: ScreenName) => void;

  // i18n
  language: Language;
  setLanguage: (lang: Language) => void;

  // upload-screen error banner
  error: string | null;
  showError: (msg: string) => void;
  hideError: () => void;

  // loading screen
  loadingLabel: string;

  // contract + flow
  contract: Contract | null;
  handleFile: (file: File) => Promise<void>;
  loadSampleContract: () => Promise<void>;

  // pre-quiz
  preQuizQuestions: Question[] | null;
  preQuizPicks: (number | null)[];
  answerPreQuiz: (qIdx: number, oIdx: number) => void;
  preQuizAnswered: number;
  preQuizScore: number;

  // summary
  streamingPartial: StreamingPartial | null;
  summaryData: SummaryData | null;
  loadSummary: () => Promise<void>;

  // quiz
  quizQuestions: Question[] | null;
  quizPicks: (number | null)[];
  answerQuiz: (qIdx: number, oIdx: number) => void;
  quizAnswered: number;
  quizScore: number;
  /** `fresh: true` always generates new questions (used by the Retry button). */
  startQuiz: (opts?: { fresh?: boolean }) => Promise<void>;
}

interface SummaryHooks {
  onText: () => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

type Status = 'idle' | 'running' | 'done' | 'error';

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

const scoreOf = (questions: Question[] | null, picks: (number | null)[]) =>
  (questions ?? []).reduce(
    (n, q, i) => (picks[i] != null && picks[i] === q.correct ? n + 1 : n),
    0,
  );

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [screenVisible, setScreenVisible] = useState(false);
  const [language, setLanguageState] = useState<Language>('en');
  const [error, setError] = useState<string | null>(null);
  // Matches the hardcoded initial text of #loadingLabel in index.html; every
  // flow overwrites it via setLoadingLabel(t(...)) before the screen is shown.
  const [loadingLabel, setLoadingLabel] = useState('Reading your contract…');

  const [contract, setContract] = useState<Contract | null>(null);

  const [preQuizQuestions, setPreQuizQuestions] = useState<Question[] | null>(null);
  const [preQuizPicks, setPreQuizPicks] = useState<(number | null)[]>([]);

  const [streamingPartial, setStreamingPartial] = useState<StreamingPartial | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const [quizQuestions, setQuizQuestions] = useState<Question[] | null>(null);
  const [quizPicks, setQuizPicks] = useState<(number | null)[]>([]);

  // ── Background generation bookkeeping (refs: no UI reads these) ────────────
  const genRef = useRef(0); // bumped whenever a new contract/summary run starts
  const summaryAbort = useRef<AbortController | null>(null);
  const quizAbort = useRef<AbortController | null>(null);
  const quizSeq = useRef(0);
  const summaryStatus = useRef<Status>('idle');
  const quizStatus = useRef<Status>('idle');
  const summaryHasText = useRef(false);
  const summaryLang = useRef<Language | null>(null);
  const quizLang = useRef<Language | null>(null);
  const summaryHooks = useRef<SummaryHooks | null>(null);
  const quizHooks = useRef<{ onError: (err: Error) => void } | null>(null);

  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef = useRef<ScreenName>('home');
  screenRef.current = screen;

  // Reveal the initial screen (matches: add 'screen-visible' after load).
  useEffect(() => {
    const id = requestAnimationFrame(() => setScreenVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // applyTranslations() sets document.title from the active language.
  useEffect(() => {
    const title = translate(language, 'page-title');
    if (typeof title === 'string') document.title = title;
  }, [language]);

  const t = useCallback(
    (key: string) => {
      const v = translate(language, key);
      return Array.isArray(v) ? key : v;
    },
    [language],
  );

  const showScreen = useCallback((name: ScreenName) => {
    if (name === screenRef.current) {
      setScreenVisible(true);
      return;
    }
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    // fade current out, then swap + fade in (index.html showScreen FADE dance)
    setScreenVisible(false);
    fadeTimer.current = setTimeout(() => {
      setScreen(name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      requestAnimationFrame(() => requestAnimationFrame(() => setScreenVisible(true)));
    }, FADE);
  }, []);

  const setLanguage = useCallback((lang: Language) => setLanguageState(lang), []);
  const showError = useCallback((msg: string) => setError(msg), []);
  const hideError = useCallback(() => setError(null), []);

  const resetQuiz = useCallback(() => {
    setQuizQuestions(null);
    setQuizPicks([]);
  }, []);

  // ── Background generation ──────────────────────────────────────────────────
  // The post-reading quiz starts as soon as the summary has parsed.
  const runQuiz = useCallback(
    async (summary: SummaryData, lang: Language, gen: number) => {
      quizAbort.current?.abort();
      const ctrl = new AbortController();
      quizAbort.current = ctrl;
      const seq = ++quizSeq.current;
      const stale = () => seq !== quizSeq.current || gen !== genRef.current;

      quizStatus.current = 'running';
      quizLang.current = lang;
      try {
        const questions = await fetchQuiz(summary, lang, ctrl.signal);
        if (stale()) return;
        setQuizQuestions(validateQuestions(questions));
        setQuizPicks([]);
        quizStatus.current = 'done';
      } catch (err) {
        if (stale()) return;
        quizStatus.current = 'error';
        quizHooks.current?.onError(err as Error);
      }
    },
    [],
  );

  // Streams the summary into state. Runs while the user answers the pre-quiz;
  // nothing is shown until they click (the Summary screen is only reachable
  // from the pre-quiz button).
  const runSummary = useCallback(
    async (c: Contract, lang: Language, hooks: SummaryHooks | null) => {
      summaryAbort.current?.abort();
      quizAbort.current?.abort();
      const ctrl = new AbortController();
      summaryAbort.current = ctrl;
      const gen = ++genRef.current;
      const stale = () => gen !== genRef.current;

      summaryStatus.current = 'running';
      quizStatus.current = 'idle';
      quizHooks.current = null;
      summaryHasText.current = false;
      summaryLang.current = lang;
      summaryHooks.current = hooks;
      setSummaryData(null);
      setStreamingPartial(null);
      setQuizQuestions(null);
      setQuizPicks([]);

      try {
        const accumulated = await streamSummary(
          { content: c.content, isImage: c.isImage, language: lang },
          (text) => {
            if (stale()) return;
            if (!summaryHasText.current) {
              summaryHasText.current = true;
              setStreamingPartial(_sumExtractPartial(''));
              summaryHooks.current?.onText();
            }
            setStreamingPartial(_sumExtractPartial(text));
          },
          ctrl.signal,
        );
        if (stale()) return;

        const summary = parseJSON(accumulated) as SummaryData;
        setSummaryData(summary);
        setStreamingPartial(null);
        summaryStatus.current = 'done';
        summaryHooks.current?.onDone();
        void runQuiz(summary, lang, gen);
      } catch (err) {
        if (stale()) return;
        setStreamingPartial(null);
        summaryStatus.current = 'error';
        summaryHooks.current?.onError(err as Error);
      }
    },
    [runQuiz],
  );

  // ── Flow: upload → pre-quiz ────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      hideError();
      showScreen('loading');

      // A new contract invalidates anything still generating for the old one.
      genRef.current++;
      summaryAbort.current?.abort();
      quizAbort.current?.abort();
      summaryStatus.current = 'idle';
      quizStatus.current = 'idle';
      summaryHooks.current = null;
      quizHooks.current = null;

      try {
        setLoadingLabel(t('loading-reading'));
        let content: string | string[];
        let isImage: boolean;
        let truncation: Truncation | null = null;

        if (file.type === 'application/pdf') {
          const pdf = await readPdf(file);
          content = pdf.content;
          isImage = pdf.kind === 'images'; // scanned PDF → page images
          if (pdf.truncated) {
            truncation =
              pdf.kind === 'images'
                ? { kind: 'pages', used: pdf.pagesUsed, total: pdf.pagesTotal }
                : { kind: 'text' };
          }
        } else if (file.type.startsWith('image/')) {
          content = await encodeImageBase64(file);
          isImage = true;
        } else {
          throw new Error('Unsupported file type. Please upload a PDF or image.');
        }

        const c: Contract = { fileName: file.name, content, isImage, truncation };
        setContract(c);
        setSummaryData(null);
        setStreamingPartial(null);
        resetQuiz();

        setLoadingLabel(t('loading-quiz'));
        const questions = await fetchPreQuiz({ content, isImage, language });

        setPreQuizQuestions(validateQuestions(questions));
        setPreQuizPicks([]);
        showScreen('prequiz');
        // Start the summary now, while the user answers the pre-quiz.
        void runSummary(c, language, null);
      } catch (err) {
        showScreen('upload');
        showError((err as Error).message || 'Something went wrong. Please try again.');
      }
    },
    [hideError, showScreen, t, language, resetQuiz, showError, runSummary],
  );

  const loadSampleContract = useCallback(async () => {
    showScreen('loading');
    setLoadingLabel(t('loading-reading'));
    let file: File;
    try {
      const res = await fetch('/SampleRentalAgreement.pdf');
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      file = new File([blob], 'SampleRentalAgreement.pdf', { type: 'application/pdf' });
      if (!file || file.size === 0) throw new Error('Sample file is empty.');
    } catch {
      showScreen('upload');
      showError('Could not load the sample contract. Please try again.');
      return;
    }
    await handleFile(file);
  }, [showScreen, t, showError, handleFile]);

  // ── Flow: pre-quiz → summary ───────────────────────────────────────────────
  // Finished → show now. Still streaming → show what's there and keep filling.
  // Failed (or language changed since it started) → try again now.
  const loadSummary = useCallback(async () => {
    if (!contract) return;

    const status = summaryStatus.current;
    const sameLang = summaryLang.current === language;
    if (sameLang && (status === 'done' || (status === 'running' && summaryHasText.current))) {
      showScreen('summary');
      return;
    }

    showScreen('loading');
    setLoadingLabel(t('loading-simplifying'));

    let shown = false;
    const hooks: SummaryHooks = {
      onText: () => {
        shown = true;
        showScreen('summary');
      },
      onDone: () => {
        if (!shown) showScreen('summary');
      },
      onError: (err) => {
        showScreen('prequiz');
        window.alert(
          'Could not generate the summary. Please try again.\n\n' + (err.message || ''),
        );
      },
    };

    if (sameLang && status === 'running') {
      summaryHooks.current = hooks; // request is in flight but silent so far
    } else {
      void runSummary(contract, language, hooks);
    }
  }, [contract, showScreen, t, language, runSummary]);

  // ── Flow: summary → quiz ──────────────────────────────────────────────────
  const startQuiz = useCallback(
    async (opts?: { fresh?: boolean }) => {
      if (!summaryData) return;
      const status = quizStatus.current;
      const sameLang = quizLang.current === language;

      quizHooks.current = {
        onError: (err) => {
          showScreen('summary');
          showError(err.message || 'Could not generate quiz questions. Please try again.');
        },
      };

      if (!opts?.fresh && sameLang && status === 'done') {
        setQuizPicks([]); // already generated in the background
        showScreen('quiz');
        return;
      }
      if (!opts?.fresh && sameLang && status === 'running') {
        showScreen('quiz'); // spinner until the background request lands
        return;
      }

      resetQuiz();
      showScreen('quiz');
      void runQuiz(summaryData, language, genRef.current);
    },
    [summaryData, resetQuiz, showScreen, language, showError, runQuiz],
  );

  // ── Answer handlers ───────────────────────────────────────────────────────
  const answerPreQuiz = useCallback((qIdx: number, oIdx: number) => {
    setPreQuizPicks((prev) => {
      if (prev[qIdx] != null) return prev;
      const next = [...prev];
      next[qIdx] = oIdx;
      return next;
    });
  }, []);

  const answerQuiz = useCallback((qIdx: number, oIdx: number) => {
    setQuizPicks((prev) => {
      if (prev[qIdx] != null) return prev;
      const next = [...prev];
      next[qIdx] = oIdx;
      return next;
    });
  }, []);

  const preQuizAnswered = preQuizPicks.filter((p) => p != null).length;
  const quizAnswered = quizPicks.filter((p) => p != null).length;
  const preQuizScore = scoreOf(preQuizQuestions, preQuizPicks);
  const quizScore = scoreOf(quizQuestions, quizPicks);

  const value = useMemo<AppState>(
    () => ({
      screen,
      screenVisible,
      showScreen,
      language,
      setLanguage,
      error,
      showError,
      hideError,
      loadingLabel,
      contract,
      handleFile,
      loadSampleContract,
      preQuizQuestions,
      preQuizPicks,
      answerPreQuiz,
      preQuizAnswered,
      preQuizScore,
      streamingPartial,
      summaryData,
      loadSummary,
      quizQuestions,
      quizPicks,
      answerQuiz,
      quizAnswered,
      quizScore,
      startQuiz,
    }),
    [
      screen,
      screenVisible,
      showScreen,
      language,
      setLanguage,
      error,
      showError,
      hideError,
      loadingLabel,
      contract,
      handleFile,
      loadSampleContract,
      preQuizQuestions,
      preQuizPicks,
      answerPreQuiz,
      preQuizAnswered,
      preQuizScore,
      streamingPartial,
      summaryData,
      loadSummary,
      quizQuestions,
      quizPicks,
      answerQuiz,
      quizAnswered,
      quizScore,
      startQuiz,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
