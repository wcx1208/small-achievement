package com.xiaochengjiu.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 供 WebView 在数据变化后立刻刷新桌面小组件（避免等 30 分钟周期刷新） */
@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    @PluginMethod
    public void refresh(PluginCall call) {
        WidgetProvider.refresh(getContext());
        call.resolve();
    }
}
