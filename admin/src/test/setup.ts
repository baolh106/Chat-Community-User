// Node >= 25 có Web Storage toàn cục (thử nghiệm) che mất localStorage của jsdom
// khi không truyền --localstorage-file. Gắn lại bản của jsdom để test giống trình duyệt.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow && !globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: jsdomWindow.localStorage,
  });
}
