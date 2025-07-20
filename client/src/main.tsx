import { render } from 'preact';
import App from './components/App';
import './styles/main.css';

// Initialize the app
render(<App />, document.getElementById('app')!);

// Initialize Lucide icons after a short delay to ensure DOM is ready
setTimeout(() => {
    if (typeof window !== 'undefined' && 'lucide' in window) {
        (window as any).lucide.createIcons();
    }
}, 100);