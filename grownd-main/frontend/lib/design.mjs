// Reads the site's design source (frontend/design/GROWND Website v2.dc.html): its page template,
// its component script and the mission data inside that script. The build and the image tool both
// start from here, so the words on the site, in search results and on share images never drift apart.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const FRONTEND = fileURLToPath(new URL('../', import.meta.url));
export const DESIGN_DIR = FRONTEND + 'design/';
export const PAGE_SOURCE = DESIGN_DIR + 'GROWND Website v2.dc.html';

export function readDesign() {
  const html = fs.readFileSync(PAGE_SOURCE, 'utf8');
  const open = /<x-dc(?:\s[^>]*)?>/.exec(html);
  const close = html.lastIndexOf('</x-dc>');
  if (!open || close < open.index) throw new Error(`${PAGE_SOURCE}: no <x-dc> block`);

  let template = html.slice(open.index + open[0].length, close);
  // <helmet> holds head tags for the design tool. The build writes its own <head>, keeping only the CSS.
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(template);
  const css = helmet ? [...helmet[1].matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1].trim()).join('\n') : '';
  if (helmet) template = template.replace(helmet[0], '');

  const scriptTag = /<script type="text\/x-dc" data-dc-script[^>]*>[\s\S]*?<\/script>/.exec(html.slice(close))?.[0];
  if (!scriptTag) throw new Error(`${PAGE_SOURCE}: no <script data-dc-script> after </x-dc>`);
  const code = scriptTag.slice(scriptTag.indexOf('>') + 1, scriptTag.lastIndexOf('</script>'));

  return { template: template.trim(), css, scriptTag, data: componentData(code) };
}

/** Builds the page component outside a browser and reads its data (missions, scientist types, quiz). */
function componentData(code) {
  const ctx = vm.createContext({
    DCLogic: class { constructor(props) { this.props = props || {}; } },
    React: { createRef: () => ({ current: null }), createElement: () => null }
  });
  vm.runInContext(`${code}\n;globalThis.__Component = Component;`, ctx, { filename: PAGE_SOURCE });
  const c = new ctx.__Component({});
  // A JSON round trip turns the objects into plain ones from this realm.
  return JSON.parse(JSON.stringify({ missions: c.M, types: c.T, order: c.order, cats: c.cats, questions: c.Q }));
}
