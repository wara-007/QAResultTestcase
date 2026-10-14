import { PICKER_WORKBOOK_MIMES, pickedWorkbook, type PickerSelection, type PickedWorkbook } from "./google-picker";

type Picker = { setVisible: (visible: boolean) => void; dispose: () => void };
type PickerView = { setMimeTypes: (types: string) => PickerView };
type PickerBuilder = {
  setDeveloperKey: (key: string) => PickerBuilder;
  setAppId: (id: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setOrigin: (origin: string) => PickerBuilder;
  setCallback: (callback: (selection: PickerSelection) => void) => PickerBuilder;
  addView: (view: PickerView) => PickerBuilder;
  build: () => Picker;
};
type PickerWindow = Window & {
  gapi?: { load: (module: string, options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void }) => void };
  google?: { picker?: { View: new (id: string) => PickerView; ViewId: { DOCS: string }; PickerBuilder: new () => PickerBuilder } };
};
let loading: Promise<void> | undefined;
function loadPicker() {
  const browser = window as PickerWindow;
  if (browser.google?.picker) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    const fail = () => { script.remove(); reject(new Error("โหลด Google Picker ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อหรือการบล็อก Google ของเบราว์เซอร์")); };
    const timer = window.setTimeout(fail, 20000);
    script.onerror = () => { clearTimeout(timer); fail(); };
    script.onload = () => {
      clearTimeout(timer);
      if (!browser.gapi) return fail();
      browser.gapi.load("picker", { callback: resolve, onerror: fail, timeout: 20000, ontimeout: fail });
    };
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export async function selectDriveWorkbook(session: { developerKey: string; appId: string; accessToken: string }, options: { expectedFileId?: string; signal?: AbortSignal } = {}): Promise<PickedWorkbook | null> {
  await loadPicker();
  if (options.signal?.aborted) return null;
  const api = (window as PickerWindow).google?.picker;
  if (!api) throw new Error("Google Picker ยังไม่พร้อม");
  return new Promise((resolve, reject) => {
    const finish = () => { options.signal?.removeEventListener("abort", cancel); picker.dispose(); };
    const cancel = () => { finish(); resolve(null); };
    const picker: Picker = new api.PickerBuilder()
      .setDeveloperKey(session.developerKey).setAppId(session.appId).setOAuthToken(session.accessToken)
      .setOrigin(window.location.origin)
      .addView(new api.View(api.ViewId.DOCS).setMimeTypes(PICKER_WORKBOOK_MIMES))
      .setCallback(selection => {
        if (selection.action !== "picked" && selection.action !== "cancel") return;
        try { const file = pickedWorkbook(selection, options.expectedFileId); finish(); resolve(file); }
        catch (error) { finish(); reject(error); }
      }).build();
    options.signal?.addEventListener("abort", cancel, { once: true });
    picker.setVisible(true);
  });
}
