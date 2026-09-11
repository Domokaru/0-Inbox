# ProGuard rules for ZeroInbox
-keepattributes *Annotation*
-keepclassmembers class * {
    @org.apache.http.annotation.NotThreadSafe <fields>;
    @org.apache.http.annotation.ThreadSafe <fields>;
    @org.apache.http.annotation.Immutable <fields>;
    @org.apache.http.annotation.GuardedBy <fields>;
}
-dontwarn com.google.api.client.**
-dontwarn com.google.common.**
-dontwarn org.apache.http.**
