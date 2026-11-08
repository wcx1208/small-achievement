package com.xiaochengjiu.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * 桌面小组件：展示连胜天数与今日完成度。
 * 数据来源：Capacitor 官方 @capacitor/preferences 插件把 WebView 里的摘要
 * 写进 SharedPreferences（文件名 CapacitorStorage，key = "widget"），
 * 本 Provider 每次刷新直接读取该文件，无需额外桥接。
 */
public class WidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        SharedPreferences sp = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = sp.getString("widget", null);

        int completed = 0;
        int total = 0;
        int streak = 0;
        String date = "";
        if (raw != null) {
            try {
                JSONObject o = new JSONObject(raw);
                completed = o.optInt("completed", 0);
                total = o.optInt("total", 0);
                streak = o.optInt("streak", 0);
                date = o.optString("date", "");
            } catch (Exception ignored) {
                // 摘要损坏时展示默认文案即可
            }
        }

        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
                .format(new java.util.Date());
        boolean stale = !today.equals(date);

        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_xiaochengjiu);
            views.setTextViewText(R.id.widget_streak, "🔥 " + streak + " 天连胜");
            if (stale) {
                views.setTextViewText(R.id.widget_progress, "打开看看今天 ✨");
                views.setProgressBar(R.id.widget_bar, 100, 0, false);
            } else if (total == 0) {
                views.setTextViewText(R.id.widget_progress, "添加今天的小事 🌱");
                views.setProgressBar(R.id.widget_bar, 100, 0, false);
            } else {
                views.setTextViewText(R.id.widget_progress, "今日 " + completed + "/" + total);
                views.setProgressBar(R.id.widget_bar, 100, Math.round(completed * 100f / total), false);
            }
            // 点小组件任意位置打开应用
            Intent intent = new Intent(context, MainActivity.class);
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
            manager.updateAppWidget(id, views);
        }
    }

    /** 供应用侧在数据变化后主动刷新已添加的小组件 */
    public static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, WidgetProvider.class));
        if (ids.length == 0) return;
        // 直接调用 onUpdate：只发 ACTION_APPWIDGET_UPDATE 而不带 ids，AOSP 会忽略广播。
        new WidgetProvider().onUpdate(context, manager, ids);
    }
}
