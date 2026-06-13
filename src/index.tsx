import { render } from 'preact';
import App from './App';

const appNode = document.getElementById('app')
if (!appNode) throw new Error("unable to find app node")

render(<App />, appNode);
