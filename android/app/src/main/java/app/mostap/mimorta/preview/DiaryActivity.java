package app.mostap.mimorta.preview;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.os.Environment;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.ClipData;
import android.net.Uri;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;
import java.util.ArrayList;
import android.view.View;
import android.webkit.*;
import java.io.File;
import java.io.IOException;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class DiaryActivity extends Activity {
    private static final String APP_PAGE = "https://appassets.androidplatform.net/assets/index.html";
    private static final int PICK_FILE = 4001;
    private static final int PICK_SPEECH = 4002;
    private WebView browser;
    private ValueCallback<Uri[]> uploadCallback;
    private Uri cameraUri;
    private WebViewAssetLoader assets;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        assets = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        browser = new WebView(this);
        browser.addJavascriptInterface(new SpeechBridge(), "MimoAndroidSpeech");
        setContentView(browser);
        browser.setBackgroundColor(android.graphics.Color.rgb(250,249,246));
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        browser.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
        });
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsPrompt(WebView v, String url, String message, String defaultValue, JsPromptResult result) {
                if (!APP_PAGE.equals(url)) return false;
                if ("mimo.ready".equals(message)) { result.confirm("diary-v1"); return true; }
                if ("mimo.diary.read".equals(message)) {
                    result.confirm(getSharedPreferences("diary", MODE_PRIVATE).getString("data", ""));
                    return true;
                }
                if ("mimo.diary.write".equals(message)) {
                    result.confirm(writeDiary(defaultValue));
                    return true;
                }
                return false;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                String[] types = params.getAcceptTypes();
                boolean image = false;
                for (String type : types) if (type != null && type.contains("image")) image = true;
                if (image) {
                    new AlertDialog.Builder(DiaryActivity.this)
                        .setTitle("Фото блюда или упаковки")
                        .setItems(new String[]{"Сфотографировать", "Выбрать из галереи"}, (dialog, which) -> {
                            Intent intent = which == 0 ? createCameraIntent() : null;
                            if (intent == null) {
                                cameraUri = null;
                                intent = createGalleryIntent();
                            }
                            launchPhotoPicker(intent);
                        })
                        .setOnCancelListener(dialog -> finishUpload(null))
                        .show();
                    return true;
                }
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                launchPhotoPicker(intent);
                return true;
            }
        });
        if (state != null) browser.restoreState(state);
        else browser.loadUrl(APP_PAGE);
    }

    @Override protected void onResume() {
        super.onResume();
        if (browser != null && APP_PAGE.equals(browser.getUrl())) {
            browser.evaluateJavascript("window.mimoNativeResume && window.mimoNativeResume()", null);
        }
    }

    private String writeDiary(String request) {
        try {
            JSONArray update = new JSONArray(request);
            String expected = update.isNull(0) ? null : update.getString(0);
            String next = update.getString(1);
            SharedPreferences prefs = getSharedPreferences("diary", MODE_PRIVATE);
            String current = prefs.getString("data", null);
            if (!java.util.Objects.equals(current, expected)) return "conflict";
            // Acknowledge only after the file is committed, even when Android kills the process immediately.
            if (prefs.edit().putString("data", next).commit()) return "saved";
            prefs.edit().putString("data", current).commit();
        } catch (JSONException | RuntimeException e) {
            return "error";
        }
        return "error";
    }

    private class SpeechBridge {
        @JavascriptInterface
        public void startRecognition() {
            runOnUiThread(() -> {
                Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
                speech.putExtra(RecognizerIntent.EXTRA_PROMPT, "Скажите, что съели");
                speech.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                try {
                    startActivityForResult(speech, PICK_SPEECH);
                } catch (Exception e) {
                    deliverSpeech("", "На телефоне не найден сервис распознавания речи. Можно ввести еду вручную.");
                }
            });
        }
    }

    private void deliverSpeech(String text, String error) {
        if (browser == null) return;
        String js = "window.mimoNativeSpeechResult && window.mimoNativeSpeechResult("
            + JSONObject.quote(text) + "," + JSONObject.quote(error) + ")";
        browser.evaluateJavascript(js, null);
    }

    private void launchPhotoPicker(Intent intent) {
        try {
            startActivityForResult(intent, PICK_FILE);
        } catch (Exception error) {
            finishUpload(null);
        }
    }

    private void finishUpload(Uri[] selected) {
        if (uploadCallback != null) uploadCallback.onReceiveValue(selected);
        uploadCallback = null;
        cameraUri = null;
    }

    private Intent createGalleryIntent() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        return Intent.createChooser(intent, "Выбрать из галереи");
    }

    private Intent createCameraIntent() {
        try {
            File directory = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (directory == null) return null;
            File photo = File.createTempFile("mimo_photo_", ".jpg", directory);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photo);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            intent.setClipData(ClipData.newRawUri("photo", cameraUri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if (intent.resolveActivity(getPackageManager()) == null) return null;
            return intent;
        } catch (IOException | IllegalArgumentException e) {
            cameraUri = null;
            return null;
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode == PICK_SPEECH) {
            if (resultCode == RESULT_OK && result != null) {
                ArrayList<String> matches = result.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (matches != null && !matches.isEmpty() && !matches.get(0).trim().isEmpty()) {
                    deliverSpeech(matches.get(0).trim(), "");
                    return;
                }
            }
            deliverSpeech("", resultCode == RESULT_CANCELED ? "" : "Речь не распознана. Попробуйте ещё раз.");
            return;
        }
        if (requestCode != PICK_FILE || uploadCallback == null) return;
        Uri[] selected = null;
        if (resultCode == RESULT_OK) {
            if (result != null && result.getClipData() != null) {
                ClipData clips = result.getClipData();
                selected = new Uri[clips.getItemCount()];
                for (int i=0; i<clips.getItemCount(); i++) selected[i] = clips.getItemAt(i).getUri();
            } else if (result != null && result.getData() != null) {
                selected = new Uri[]{result.getData()};
            } else if (cameraUri != null) {
                selected = new Uri[]{cameraUri};
            }
        }
        finishUpload(selected);
    }

    @Override public void onBackPressed() {
        if (browser.canGoBack()) browser.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        browser.saveState(state);
        super.onSaveInstanceState(state);
    }
}
