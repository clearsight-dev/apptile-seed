package com.apptileseed;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.HashMap;
import java.util.Map;

public class RNApptileModule extends ReactContextBaseJavaModule {
    private static ReactApplicationContext reactContext;

    public RNApptileModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "RNApptile";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("VERSION_CODE", BuildConfig.VERSION_CODE);
        return constants;
    }

    @ReactMethod
    public void notifyJSReady() {
        MainActivity activity = (MainActivity) reactContext.getCurrentActivity();
        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.removeSplash();
                }
            });
        }
    }

    // @ReactMethod
    // public void getVersionNumber(Callback cb) {
    //   cb.invoke(BuildConfig.VERSION_CODE);
    // }
}
