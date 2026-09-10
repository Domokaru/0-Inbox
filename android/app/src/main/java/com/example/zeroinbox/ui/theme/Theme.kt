package com.example.zeroinbox.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Vibrant Neon Dark Theme
val NeonDarkColorScheme = darkColorScheme(
    primary = Color(0xFF00FFFF),       // Neon Cyan
    secondary = Color(0xFFFF00FF),     // Neon Magenta
    tertiary = Color(0xFF007BFF),      // Electric Blue
    background = Color(0xFF0F0F13),    // Dark Charcoal / Black Canvas
    surface = Color(0xFF15151A),       // Elevated Card Dark Surface
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onTertiary = Color.White,
    onBackground = Color.White,
    onSurface = Color(0xFFE5E7EB),
    outline = Color(0xFF2E2E3C)
)

// Clean Pastel Light Theme (White Background + Pastel Accents)
val PastelLightColorScheme = lightColorScheme(
    primary = Color(0xFF0EA5E9),       // Pastel Sky Cyan
    secondary = Color(0xFFEC4899),     // Pastel Rose Magenta
    tertiary = Color(0xFF3B82F6),      // Pastel Royal Blue
    background = Color(0xFFFFFFFF),    // Pure Crisp White
    surface = Color(0xFFF8FAFC),       // Soft Light Card Surface
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color(0xFF0F172A),  // Slate 900 for high legibility
    onSurface = Color(0xFF1E293B),     // Slate 800
    outline = Color(0xFFE2E8F0)        // Subtle Border Divider
)

@Composable
fun ZeroInboxTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) NeonDarkColorScheme else PastelLightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
