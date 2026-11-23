package app.mostap.mimorta.preview;

import android.app.Activity;
import android.os.Bundle;
import android.os.Environment;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.*;
import java.io.File;
import java.io.IOException;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class DiaryActivity extends Activity {
    private static final int PICK_FILE = 4001;
    private WebView browser;
    private ValueCallback<Uri[]> uploadCallback;
    private Uri cameraUri;
    private final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        browser = new WebView(this);
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
                if ("mimo.ready".equals(message)) { result.confirm(""); return true; }
                return false;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                String[] types = params.getAcceptTypes();
                boolean image = false;
                for (String type : types) if (type != null && type.contains("image")) image = true;
                Intent intent;
                if (image && params.isCaptureEnabled()) {
                    intent = createCameraIntent();
                    if (intent == null) intent = createGalleryIntent();
                } else if (image) {
                    intent = createGalleryIntent();
                } else {
                    intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                }
                try { startActivityForResult(intent, PICK_FILE); }
                catch (Exception e) { uploadCallback.onReceiveValue(null); uploadCallback = null; return false; }
                return true;
            }
        });
        if (state != null) browser.restoreState(state);
        else browser.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private Intent createGalleryIntent() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        return Intent.createChooser(intent, "Выберите фото");
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
        uploadCallback.onReceiveValue(selected);
        uploadCallback = null;
        cameraUri = null;
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
