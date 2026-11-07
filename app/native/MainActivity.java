package com.yfeeeee.pixelminers;

// Developer: @yfeeeee
import android.content.Intent;
import android.os.Build;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Native(), "LootifyNative");
        }
    }

    class Native {
        @JavascriptInterface
        public void voice(boolean on) {
            Intent i = new Intent(MainActivity.this, VoiceService.class);
            if (on) {
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
            } else {
                stopService(i);
            }
        }
    }
}
