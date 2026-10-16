import '@testing-library/jest-dom/vitest'

// jsdom implements no layout, so scrollIntoView does not exist on elements. Components
// that scroll a result into view would throw in tests without this stub.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// No unit test may reach the network. Without this, a component that loads a catalogue
// on mount dials the real Supabase project named in frontend/.env, so the suite depends
// on that project's grants and the machine being online — and a test can pass only
// because the request failed. Any test that needs a response must mock its own service.
globalThis.fetch = (() => {
  throw new Error(
    'Network access is disabled in tests. Mock the service this component calls.',
  )
}) as unknown as typeof fetch
