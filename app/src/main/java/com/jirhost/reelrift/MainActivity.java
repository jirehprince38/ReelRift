
package com.jirhost.reelrift;

import android.app.Activity;
import android.os.Bundle;
import android.os.Message;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private WebView popupWebView;
    private FrameLayout root;
    private View customView;
    private FrameLayout fullScreenContainer;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private long lastBackPressed = 0;

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        view.setBackgroundColor(0xFF07070A);
        view.setWebViewClient(new WebViewClient());
    }

    private WebChromeClient createChromeClient(final WebView owner) {
        return new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                fullScreenContainer = new FrameLayout(MainActivity.this);
                fullScreenContainer.setBackgroundColor(0xFF000000);
                fullScreenContainer.addView(view, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));
                setContentView(fullScreenContainer);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                if (fullScreenContainer != null) {
                    fullScreenContainer.removeView(customView);
                }
                customView = null;
                fullScreenContainer = null;
                setContentView(root);
                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                }
                customViewCallback = null;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog,
                    boolean isUserGesture, Message resultMsg) {
                if (popupWebView != null) {
                    closePopup();
                }

                popupWebView = new WebView(MainActivity.this);
                configureWebView(popupWebView);
                popupWebView.setWebChromeClient(createPopupChromeClient());

                root.addView(popupWebView, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));

                WebView.WebViewTransport transport =
                        (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }
        };
    }

    private WebChromeClient createPopupChromeClient() {
        return new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                closePopup();
            }
        };
    }

    private void closePopup() {
        if (popupWebView == null) return;
        root.removeView(popupWebView);
        popupWebView.stopLoading();
        popupWebView.destroy();
        popupWebView = null;
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        webView = new WebView(this);
        configureWebView(webView);
        webView.setWebChromeClient(createChromeClient(webView));

        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        webView.loadUrl("https://reelrift-lake.vercel.app/");
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            if (customViewCallback != null) {
                customViewCallback.onCustomViewHidden();
            }
            customView = null;
            fullScreenContainer = null;
            setContentView(root);
        } else if (popupWebView != null) {
            closePopup();
        } else if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            long currentTime = SystemClock.elapsedRealtime();

            if (currentTime - lastBackPressed < 2000) {
                super.onBackPressed();
            } else {
                lastBackPressed = currentTime;
                Toast.makeText(this,
                        "Press Back again to exit ReelRift",
                        Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (popupWebView != null) popupWebView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        if (popupWebView != null) popupWebView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (popupWebView != null) {
            popupWebView.destroy();
            popupWebView = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
                    }
            
