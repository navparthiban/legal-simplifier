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
import { extractPdfText } from '../lib/pdf';
import { encodeImageBase64 } from '../lib/image';
import { parseJSON } from '../lib/parseJSON';
import { _sumExtractPartial } from '../lib/summaryStream';
import { validateQuestions } from '../lib/quiz';
import type { Question, StreamingPartial, SummaryData } from '../lib/types';

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
  content: string;
  isImage: boolean;
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
  startQuiz: () => Promise<void>;
}

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

  // ── Flow: upload → pre-quiz ────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      hideError();
      showScreen('loading');

      try {
        setLoadingLabel(t('loading-reading'));
        let content: string;
        let isImage: boolean;

        if (file.type === 'application/pdf') {
          content = await extractPdfText(file);
          isImage = false;
        } else if (file.type.startsWith('image/')) {
          content = await encodeImageBase64(file);
          isImage = true;
        } else {
          throw new Error('Unsupported file type. Please upload a PDF or image.');
        }

        setContract({ fileName: file.name, content, isImage });
        setSummaryData(null);
        setStreamingPartial(null);
        resetQuiz();

        setLoadingLabel(t('loading-quiz'));
        const questions = await fetchPreQuiz({ content, isImage, language });

        setPreQuizQuestions(validateQuestions(questions));
        setPreQuizPicks([]);
        showScreen('prequiz');
      } catch (err) {
        showScreen('upload');
        showError((err as Error).message || 'Something went wrong. Please try again.');
      }
    },
    [hideError, showScreen, t, language, resetQuiz, showError],
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

  // ── Flow: pre-quiz → summary (streaming) ───────────────────────────────────
  const loadSummary = useCallback(async () => {
    if (!contract) return;
    showScreen('loading');
    setLoadingLabel(t('loading-simplifying'));

    let screenShown = false;
    try {
      const accumulated = await streamSummary(
        { content: contract.content, isImage: contract.isImage, language },
        (text) => {
          if (!screenShown) {
            setStreamingPartial(_sumExtractPartial(''));
            showScreen('summary');
            screenShown = true;
          }
          setStreamingPartial(_sumExtractPartial(text));
        },
      );

      const summary = parseJSON(accumulated) as SummaryData;
      setSummaryData(summary);
      setStreamingPartial(null);
      if (!screenShown) showScreen('summary');
    } catch (err) {
      showScreen('prequiz');
      window.alert(
        'Could not generate the summary. Please try again.\n\n' + ((err as Error).message || ''),
      );
    }
  }, [contract, showScreen, t, language]);

  // ── Flow: summary → quiz ──────────────────────────────────────────────────
  const startQuiz = useCallback(async () => {
    if (!summaryData) return;
    resetQuiz();
    showScreen('quiz');
    try {
      const questions = await fetchQuiz(summaryData, language);
      setQuizQuestions(validateQuestions(questions));
      setQuizPicks([]);
    } catch (err) {
      showScreen('summary');
      showError((err as Error).message || 'Could not generate quiz questions. Please try again.');
    }
  }, [summaryData, resetQuiz, showScreen, language, showError]);

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
