import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { useApp } from './state/AppContext';
import { Home } from './screens/Home';
import { Upload } from './screens/Upload';
import { Loading } from './screens/Loading';
import { PreQuiz } from './screens/PreQuiz';
import { Summary } from './screens/Summary';
import { Quiz } from './screens/Quiz';
import { Compare } from './screens/Compare';

export function App() {
  const { screen } = useApp();
  return (
    <>
      <Nav />
      {screen === 'home' && <Home />}
      {screen === 'upload' && <Upload />}
      {screen === 'loading' && <Loading />}
      {screen === 'prequiz' && <PreQuiz />}
      {screen === 'summary' && <Summary />}
      {screen === 'quiz' && <Quiz />}
      {screen === 'compare' && <Compare />}
      <Footer />
    </>
  );
}
