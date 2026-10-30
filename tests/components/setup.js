import {afterEach,vi} from 'vitest';
import {cleanup} from './utilities.js';
// Layout observation is provided by the browser; real geometry is covered by Playwright.
vi.stubGlobal('ResizeObserver',class{observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn();});
Object.defineProperty(Element.prototype,'scrollIntoView',{value:vi.fn(),configurable:true});
// jsdom lacks native dialog methods; browser E2E covers real modal semantics.
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
