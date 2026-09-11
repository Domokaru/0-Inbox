package com.example.zeroinbox.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Drafts
import androidx.compose.material.icons.filled.DriveFileMove
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Label
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.zeroinbox.EmailModel
import com.example.zeroinbox.LabelModel
import com.example.zeroinbox.MailViewModel
import com.example.zeroinbox.SwipeDirection
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

@Composable
fun SwipeableMailStack(
    viewModel: MailViewModel,
    isDarkTheme: Boolean = true,
    onToggleTheme: (Boolean) -> Unit = {},
    onLaunchAccountPicker: () -> Unit = {},
    onManualAccountEntered: (String) -> Unit = {},
    onSignOut: () -> Unit = {}
) {
    val emails by viewModel.emails.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val hasMore by viewModel.hasMore.collectAsState()
    val labels by viewModel.labels.collectAsState()
    val isRefreshingLabels by viewModel.isRefreshingLabels.collectAsState()
    val currentAccount by viewModel.currentAccount.collectAsState()
    val isDemoMode by viewModel.isDemoMode.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var activePopup by remember { mutableStateOf<PopupAction?>(null) }
    var showSettingsDialog by remember { mutableStateOf(false) }
    var showEmailInputDialog by remember { mutableStateOf(false) }
    var emailForLabelDialog by remember { mutableStateOf<EmailModel?>(null) }

    // Theme-derived palette
    val backgroundColor = if (isDarkTheme) Color(0xFF0F0F13) else Color(0xFFFFFFFF)
    val textColor = if (isDarkTheme) Color.White else Color(0xFF0F172A)
    val cardSurface = if (isDarkTheme) Color(0xFF15151A) else Color(0xFFF8FAFC)
    val primaryAccent = if (isDarkTheme) Color(0xFF00FFFF) else Color(0xFF0EA5E9)   // Cyan / Pastel Cyan
    val secondaryAccent = if (isDarkTheme) Color(0xFFFF00FF) else Color(0xFFEC4899) // Magenta / Pastel Rose
    val tertiaryAccent = if (isDarkTheme) Color(0xFF007BFF) else Color(0xFF3B82F6)  // Electric Blue / Pastel Blue

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        // Top App Header: Pixelated "0 INBOX" with Slashed Zero and Account Status
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(top = 18.dp, start = 16.dp, end = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onDoubleTap = {
                                showSettingsDialog = true
                            },
                            onTap = {
                                showSettingsDialog = true
                            }
                        )
                    }
                    .padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                PixelZeroInboxLogo(
                    zeroColor = primaryAccent,
                    inboxColor = secondaryAccent,
                    pixelSizeDp = 3.5f
                )
            }

            // Active Account / Demo Indicator Chip
            if (currentAccount != null || isDemoMode) {
                Surface(
                    onClick = { showSettingsDialog = true },
                    shape = RoundedCornerShape(16.dp),
                    color = if (isDarkTheme) Color(0xFF1E1E28) else Color(0xFFF1F5F9),
                    border = BorderStroke(1.dp, tertiaryAccent.copy(alpha = 0.5f)),
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .background(if (isDemoMode) secondaryAccent else Color(0xFF10B981), CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isDemoMode) "⚡ DEMO MODE" else (currentAccount ?: ""),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = textColor.copy(alpha = 0.85f)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = "Account Settings",
                            tint = tertiaryAccent,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // Error message notification banner
        errorMessage?.let { error ->
            Card(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 80.dp, start = 16.dp, end = 16.dp)
                    .fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (isDarkTheme) Color(0xFF2C1518) else Color(0xFFFEE2E2)
                ),
                border = BorderStroke(1.dp, Color(0xFFEF4444)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFEF4444),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = error,
                        fontSize = 11.sp,
                        color = if (isDarkTheme) Color(0xFFFCA5A5) else Color(0xFF991B1B),
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    TextButton(
                        onClick = {
                            viewModel.clearError()
                            viewModel.loadNextBatch()
                        },
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("RETRY", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                    }
                }
            }
        }

        // Connect Gmail Account Screen when neither account nor demo is chosen
        if (currentAccount == null && !isDemoMode) {
            Card(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .padding(horizontal = 20.dp)
                    .border(2.dp, primaryAccent, RoundedCornerShape(20.dp)),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = cardSurface
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(54.dp)
                            .background(primaryAccent.copy(alpha = 0.15f), CircleShape)
                            .border(1.5.dp, primaryAccent, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Email,
                            contentDescription = null,
                            tint = primaryAccent,
                            modifier = Modifier.size(26.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "CONNECT GMAIL",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.5.sp,
                        color = textColor
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Select your Google account or enter your email address to triage your inbox with 4-way gesture swipes.",
                        fontSize = 12.5.sp,
                        color = if (isDarkTheme) Color(0xFFAAAAAA) else Color(0xFF64748B),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        lineHeight = 17.sp
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    Button(
                        onClick = onLaunchAccountPicker,
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = primaryAccent)
                    ) {
                        Icon(Icons.Default.AccountCircle, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "CHOOSE GOOGLE ACCOUNT",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { showEmailInputDialog = true },
                        modifier = Modifier.fillMaxWidth().height(46.dp),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.5.dp, secondaryAccent)
                    ) {
                        Icon(Icons.Default.Edit, contentDescription = null, tint = secondaryAccent, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "ENTER GMAIL ADDRESS",
                            color = secondaryAccent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    TextButton(
                        onClick = { viewModel.enableDemoMode() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "TRY DEMO MODE (SAMPLE INBOX)",
                            color = tertiaryAccent,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }

        // Empty state when all emails are triaged: Big pixelated 0 in center
        if (emails.isEmpty() && !isLoading) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                BigPixelZero(
                    color = primaryAccent,
                    pixelSizeDp = 16f
                )
                Spacer(modifier = Modifier.height(18.dp))
                Text(
                    text = "0 INBOX ACHIEVED!",
                    color = secondaryAccent,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "All emails triaged • 0 unread",
                    color = if (isDarkTheme) Color(0xFFAAAAAA) else Color(0xFF64748B),
                    fontSize = 12.sp
                )
            }
        }

        // Informational card at the bottom of the stack
        if (hasMore) {
            InfoCard(
                isDarkTheme = isDarkTheme,
                borderColor = tertiaryAccent,
                onClick = { viewModel.loadNextBatch() }
            )
        }

        // Active Email Tinder Cards
        emails.forEachIndexed { index, email ->
            val isTopCard = index == emails.lastIndex
            EmailCard(
                email = email,
                isTopCard = isTopCard,
                isDarkTheme = isDarkTheme,
                cardSurface = cardSurface,
                borderColor = secondaryAccent,
                senderColor = primaryAccent,
                onSwiped = { direction ->
                    showPopupAndClear(direction, isDarkTheme, coroutineScope) { activePopup = it }
                    viewModel.processEmailSwipe(email, direction)

                    val actionLabel = when (direction) {
                        SwipeDirection.RIGHT -> "Archived"
                        SwipeDirection.LEFT -> "Deleted"
                        SwipeDirection.UP -> "Marked 'Needs Response'"
                        SwipeDirection.DOWN -> "Marked as read"
                    }

                    coroutineScope.launch {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        val result = snackbarHostState.showSnackbar(
                            message = "$actionLabel email from ${email.sender}",
                            actionLabel = "UNDO",
                            duration = SnackbarDuration.Short
                        )
                        if (result == SnackbarResult.ActionPerformed) {
                            viewModel.undoLastAction()
                        }
                    }
                },
                onLongPress = {
                    emailForLabelDialog = email
                }
            )
        }

        if (isLoading) {
            CircularProgressIndicator(
                color = secondaryAccent,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 90.dp)
            )
        }

        // Screen-centered Popup: ONLY the Neon/Pastel Icon, NO words or subtitles!
        activePopup?.let { popup ->
            NeonIconOnlyPopup(popup = popup)
        }

        // Small text indicating unread emails in inbox: under cards, above bottom icons
        Text(
            text = if (emails.isEmpty()) "0 emails unread in inbox" else "${emails.size} emails unread in inbox",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = if (emails.isEmpty()) primaryAccent else (if (isDarkTheme) Color(0xFFAAAAAA) else Color(0xFF64748B)),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 128.dp)
        )

        // Bottom Action Bar: 5 quick-action buttons including Custom Label (No Swipe required)
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 76.dp)
                .fillMaxWidth(0.92f),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 1. Delete (Left)
            IconButton(
                onClick = {
                    if (emails.isNotEmpty()) {
                        val email = emails.last()
                        showPopupAndClear(SwipeDirection.LEFT, isDarkTheme, coroutineScope) { activePopup = it }
                        viewModel.processEmailSwipe(email, SwipeDirection.LEFT)
                    }
                },
                modifier = Modifier
                    .size(42.dp)
                    .background(if (isDarkTheme) Color(0x22FF3366) else Color(0x15EF4444), CircleShape)
                    .border(1.dp, if (isDarkTheme) Color(0x66FF3366) else Color(0x44EF4444), CircleShape)
            ) {
                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = if (isDarkTheme) Color(0xFFFF3366) else Color(0xFFEF4444))
            }

            // 2. Needs Update (Up)
            IconButton(
                onClick = {
                    if (emails.isNotEmpty()) {
                        val email = emails.last()
                        showPopupAndClear(SwipeDirection.UP, isDarkTheme, coroutineScope) { activePopup = it }
                        viewModel.processEmailSwipe(email, SwipeDirection.UP)
                    }
                },
                modifier = Modifier
                    .size(42.dp)
                    .background(if (isDarkTheme) Color(0x22FF00FF) else Color(0x15EC4899), CircleShape)
                    .border(1.dp, if (isDarkTheme) Color(0x66FF00FF) else Color(0x44EC4899), CircleShape)
            ) {
                Icon(Icons.Default.Edit, contentDescription = "Needs Update", tint = secondaryAccent)
            }

            // 3. Assign Custom Label (NO SWIPE ACTIVITY - Long press or tap button opens Gmail labels dialog)
            IconButton(
                onClick = {
                    if (emails.isNotEmpty()) {
                        emailForLabelDialog = emails.last()
                    }
                },
                modifier = Modifier
                    .size(48.dp)
                    .background(if (isDarkTheme) Color(0x3300FFFF) else Color(0x220EA5E9), CircleShape)
                    .border(2.dp, primaryAccent, CircleShape)
            ) {
                Icon(Icons.Default.DriveFileMove, contentDescription = "Assign Gmail Label", tint = primaryAccent)
            }

            // 4. Mark Read (Down)
            IconButton(
                onClick = {
                    if (emails.isNotEmpty()) {
                        val email = emails.last()
                        showPopupAndClear(SwipeDirection.DOWN, isDarkTheme, coroutineScope) { activePopup = it }
                        viewModel.processEmailSwipe(email, SwipeDirection.DOWN)
                    }
                },
                modifier = Modifier
                    .size(42.dp)
                    .background(if (isDarkTheme) Color(0x22007BFF) else Color(0x153B82F6), CircleShape)
                    .border(1.dp, if (isDarkTheme) Color(0x66007BFF) else Color(0x443B82F6), CircleShape)
            ) {
                Icon(Icons.Default.Drafts, contentDescription = "Mark Read", tint = tertiaryAccent)
            }

            // 5. Archive (Right)
            IconButton(
                onClick = {
                    if (emails.isNotEmpty()) {
                        val email = emails.last()
                        showPopupAndClear(SwipeDirection.RIGHT, isDarkTheme, coroutineScope) { activePopup = it }
                        viewModel.processEmailSwipe(email, SwipeDirection.RIGHT)
                    }
                },
                modifier = Modifier
                    .size(42.dp)
                    .background(if (isDarkTheme) Color(0x2200FFFF) else Color(0x150EA5E9), CircleShape)
                    .border(1.dp, primaryAccent.copy(alpha = 0.4f), CircleShape)
            ) {
                Icon(Icons.Default.Archive, contentDescription = "Archive", tint = primaryAccent)
            }
        }

        // Material 3 Neon / Pastel Snackbar with Undo Button
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 20.dp, start = 16.dp, end = 16.dp)
        ) { data ->
            Snackbar(
                snackbarData = data,
                containerColor = if (isDarkTheme) Color(0xFF1B1B26) else Color(0xFFF1F5F9),
                contentColor = if (isDarkTheme) Color.White else Color(0xFF0F172A),
                actionColor = primaryAccent,
                actionContentColor = primaryAccent,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.border(
                    1.5.dp,
                    tertiaryAccent,
                    RoundedCornerShape(16.dp)
                )
            )
        }

        // Label Selection Dialog (triggered by Long-Pressing card OR tapping bottom Label button)
        emailForLabelDialog?.let { targetEmail ->
            LabelSelectionDialog(
                email = targetEmail,
                labels = labels,
                isRefreshing = isRefreshingLabels,
                isDarkTheme = isDarkTheme,
                primaryAccent = primaryAccent,
                secondaryAccent = secondaryAccent,
                onRefresh = { viewModel.refreshLabels() },
                onSelectLabel = { chosenLabel ->
                    emailForLabelDialog = null
                    // 1. Show Screen-Centered Popup (Icon only, zero words)
                    coroutineScope.launch {
                        activePopup = PopupAction(icon = Icons.Default.DriveFileMove, color = primaryAccent)
                        delay(700)
                        activePopup = null
                    }
                    // 2. Dispatch to ViewModel (Applies label, marks read, archives/moves from inbox)
                    viewModel.applyCustomLabel(targetEmail, chosenLabel)
                    // 3. Show Snackbar with UNDO
                    coroutineScope.launch {
                        snackbarHostState.currentSnackbarData?.dismiss()
                        val result = snackbarHostState.showSnackbar(
                            message = "Moved to '${chosenLabel.name}' & marked read",
                            actionLabel = "UNDO",
                            duration = SnackbarDuration.Short
                        )
                        if (result == SnackbarResult.ActionPerformed) {
                            viewModel.undoLastAction()
                        }
                    }
                },
                onDismiss = { emailForLabelDialog = null }
            )
        }

        // Settings Dialog (triggered by double tapping "0 INBOX")
        if (showSettingsDialog) {
            SettingsDialog(
                isDarkTheme = isDarkTheme,
                onToggleTheme = onToggleTheme,
                onDismiss = { showSettingsDialog = false }
            )
        }
    }
}

@Composable
fun InfoCard(
    isDarkTheme: Boolean,
    borderColor: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth(0.86f)
            .aspectRatio(0.72f)
            .padding(16.dp)
            .border(2.5.dp, borderColor, RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isDarkTheme) Color(0xFF1A1A24) else Color(0xFFF8FAFC)
        ),
        onClick = onClick
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "More Emails Available",
                    color = if (isDarkTheme) Color.White else Color(0xFF0F172A),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Tap to fetch next batch of 20",
                    color = borderColor,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun EmailCard(
    email: EmailModel,
    isTopCard: Boolean,
    isDarkTheme: Boolean,
    cardSurface: Color,
    borderColor: Color,
    senderColor: Color,
    onSwiped: (SwipeDirection) -> Unit,
    onLongPress: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val offsetX = remember { Animatable(0f) }
    val offsetY = remember { Animatable(0f) }
    val rotation = remember { Animatable(0f) }

    val threshold = 300f

    Card(
        modifier = Modifier
            .fillMaxWidth(0.9f)
            .aspectRatio(0.65f)
            .padding(16.dp)
            .graphicsLayer {
                translationX = offsetX.value
                translationY = offsetY.value
                rotationZ = rotation.value
            }
            .border(3.dp, borderColor, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .pointerInput(isTopCard) {
                if (!isTopCard) return@pointerInput
                detectTapGestures(
                    onLongPress = {
                        onLongPress()
                    }
                )
            }
            .pointerInput(isTopCard) {
                if (!isTopCard) return@pointerInput

                detectDragGestures(
                    onDragEnd = {
                        coroutineScope.launch {
                            val targetX = offsetX.value
                            val targetY = offsetY.value

                            if (abs(targetX) > abs(targetY)) {
                                if (targetX > threshold) {
                                    offsetX.animateTo(1000f, tween(300))
                                    onSwiped(SwipeDirection.RIGHT)
                                } else if (targetX < -threshold) {
                                    offsetX.animateTo(-1000f, tween(300))
                                    onSwiped(SwipeDirection.LEFT)
                                } else {
                                    launch { offsetX.animateTo(0f, tween(300)) }
                                    launch { offsetY.animateTo(0f, tween(300)) }
                                    launch { rotation.animateTo(0f, tween(300)) }
                                }
                            } else {
                                if (targetY > threshold) {
                                    offsetY.animateTo(1000f, tween(300))
                                    onSwiped(SwipeDirection.DOWN)
                                } else if (targetY < -threshold) {
                                    offsetY.animateTo(-1000f, tween(300))
                                    onSwiped(SwipeDirection.UP)
                                } else {
                                    launch { offsetX.animateTo(0f, tween(300)) }
                                    launch { offsetY.animateTo(0f, tween(300)) }
                                    launch { rotation.animateTo(0f, tween(300)) }
                                }
                            }
                        }
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        coroutineScope.launch {
                            offsetX.snapTo(offsetX.value + dragAmount.x)
                            offsetY.snapTo(offsetY.value + dragAmount.y)
                            rotation.snapTo(offsetX.value * 0.05f)
                        }
                    }
                )
            },
        colors = CardDefaults.cardColors(containerColor = cardSurface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = email.sender,
                color = senderColor,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = email.subject,
                color = if (isDarkTheme) Color.White else Color(0xFF0F172A),
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 30.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = email.snippet,
                color = if (isDarkTheme) Color(0xFFAAAAAA) else Color(0xFF475569),
                fontSize = 15.sp,
                maxLines = 6,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// Strictly Icon-Only Popup Action
data class PopupAction(val icon: ImageVector, val color: Color)

@Composable
fun NeonIconOnlyPopup(popup: PopupAction) {
    Box(
        modifier = Modifier
            .size(130.dp)
            .background(Color(0xCC000000), CircleShape)
            .border(3.5.dp, popup.color, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = popup.icon,
            contentDescription = null,
            tint = popup.color,
            modifier = Modifier.size(68.dp)
        )
    }
}

private fun showPopupAndClear(
    direction: SwipeDirection,
    isDarkTheme: Boolean,
    coroutineScope: kotlinx.coroutines.CoroutineScope,
    setPopup: (PopupAction?) -> Unit
) {
    val (icon, color) = when (direction) {
        SwipeDirection.RIGHT -> Pair(
            Icons.Default.Archive,
            if (isDarkTheme) Color(0xFF00FFFF) else Color(0xFF0EA5E9)
        )
        SwipeDirection.LEFT -> Pair(
            Icons.Default.Delete,
            if (isDarkTheme) Color(0xFFFF3366) else Color(0xFFF87171)
        )
        SwipeDirection.UP -> Pair(
            Icons.Default.Edit,
            if (isDarkTheme) Color(0xFFFF00FF) else Color(0xFFEC4899)
        )
        SwipeDirection.DOWN -> Pair(
            Icons.Default.Drafts,
            if (isDarkTheme) Color(0xFF007BFF) else Color(0xFF3B82F6)
        )
    }

    coroutineScope.launch {
        setPopup(PopupAction(icon, color))
        delay(700) // Strictly less than 1 second
        setPopup(null)
    }
}

@Composable
fun SettingsDialog(
    isDarkTheme: Boolean,
    onToggleTheme: (Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Settings",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Dark Theme",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = if (isDarkTheme) "Neon Palette on Dark Canvas" else "Pastel Palette on White Canvas",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = isDarkTheme,
                        onCheckedChange = { onToggleTheme(it) }
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("DONE", fontWeight = FontWeight.Bold)
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LabelSelectionDialog(
    email: EmailModel,
    labels: List<LabelModel>,
    isRefreshing: Boolean,
    isDarkTheme: Boolean,
    primaryAccent: Color,
    secondaryAccent: Color,
    onRefresh: () -> Unit,
    onSelectLabel: (LabelModel) -> Unit,
    onDismiss: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var selectedLabel by remember(labels) { mutableStateOf(labels.firstOrNull()) }
    var searchQuery by remember { mutableStateOf("") }

    val filteredLabels = remember(labels, searchQuery) {
        if (searchQuery.isBlank()) labels
        else labels.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Icon(
                        imageVector = Icons.Default.DriveFileMove,
                        contentDescription = null,
                        tint = primaryAccent,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Assign Label",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                }

                IconButton(onClick = onRefresh) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh Labels from Gmail",
                        tint = if (isRefreshing) primaryAccent else Color.Gray,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                // Email snippet card
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDarkTheme) Color(0xFF1E1E28) else Color(0xFFF1F5F9)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = email.sender,
                            color = primaryAccent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = email.subject,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Text(
                    text = "SELECT GMAIL LABEL",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Gray,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(6.dp))

                // Custom Dropdown Picker Box
                Box(modifier = Modifier.fillMaxWidth()) {
                    OutlinedCard(
                        onClick = { expanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.outlinedCardColors(
                            containerColor = if (isDarkTheme) Color(0xFF161622) else Color.White
                        )
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = selectedLabel?.name ?: if (isRefreshing) "Refreshing labels..." else "Choose a label...",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = if (selectedLabel != null) (if (isDarkTheme) Color.White else Color.Black) else Color.Gray
                            )
                            Icon(
                                imageVector = Icons.Default.Label,
                                contentDescription = null,
                                tint = primaryAccent,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false },
                        modifier = Modifier.fillMaxWidth(0.8f).heightIn(max = 280.dp)
                    ) {
                        if (filteredLabels.isEmpty()) {
                            DropdownMenuItem(
                                text = { Text("No labels found", fontSize = 13.sp, color = Color.Gray) },
                                onClick = {}
                            )
                        } else {
                            filteredLabels.forEach { label ->
                                DropdownMenuItem(
                                    text = {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = label.name,
                                                fontSize = 14.sp,
                                                fontWeight = if (label.id == selectedLabel?.id) FontWeight.Bold else FontWeight.Normal,
                                                color = if (label.id == selectedLabel?.id) primaryAccent else Color.Unspecified
                                            )
                                            if (label.id == selectedLabel?.id) {
                                                Icon(
                                                    imageVector = Icons.Default.Check,
                                                    contentDescription = null,
                                                    tint = primaryAccent,
                                                    modifier = Modifier.size(16.dp)
                                                )
                                            }
                                        }
                                    },
                                    onClick = {
                                        selectedLabel = label
                                        expanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Action Summary Box
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isDarkTheme) Color(0xFF111118) else Color(0xFFF8FAFC)
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = "Actions on apply:",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Gray
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Apply selected label in Gmail", fontSize = 12.sp)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Mark as read", fontSize = 12.sp)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Move from Inbox to label", fontSize = 12.sp)
                        }
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("CANCEL")
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    selectedLabel?.let { onSelectLabel(it) }
                },
                enabled = selectedLabel != null,
                colors = ButtonDefaults.buttonColors(containerColor = primaryAccent)
            ) {
                Text("APPLY & MOVE", fontWeight = FontWeight.Bold)
            }
        }
    )
}

/**
 * Custom retro 8-bit visual pixel-art logo for "0 INBOX".
 * Every character is built on an identical 7-row height grid (exact same font size).
 * The number zero features a classic diagonal cross-hatch slash (Ø).
 * Each pixel is rendered as an explicit square block with sharp pixel edges.
 */
@Composable
fun PixelZeroInboxLogo(
    zeroColor: Color,
    inboxColor: Color,
    pixelSizeDp: Float = 3.5f
) {
    val glyphs = remember(zeroColor, inboxColor) {
        listOf(
            // Classic Slashed Zero with diagonal cross-hatch:
            // Top-right to bottom-left slash pixels: (4,1), (3,2), (2,3), (1,4)
            Pair(
                listOf(
                    "011110",
                    "100011",
                    "100101",
                    "101001",
                    "110001",
                    "100001",
                    "011110"
                ),
                zeroColor
            ),
            // Space between 0 and INBOX
            Pair(
                listOf(
                    "00",
                    "00",
                    "00",
                    "00",
                    "00",
                    "00",
                    "00"
                ),
                Color.Transparent
            ),
            // I (same 7-row height)
            Pair(
                listOf(
                    "111",
                    "010",
                    "010",
                    "010",
                    "010",
                    "010",
                    "111"
                ),
                inboxColor
            ),
            // N (same 7-row height)
            Pair(
                listOf(
                    "10001",
                    "11001",
                    "10101",
                    "10011",
                    "10001",
                    "10001",
                    "10001"
                ),
                inboxColor
            ),
            // B (same 7-row height)
            Pair(
                listOf(
                    "11110",
                    "10001",
                    "10001",
                    "11110",
                    "10001",
                    "10001",
                    "11110"
                ),
                inboxColor
            ),
            // O (same 7-row height)
            Pair(
                listOf(
                    "01110",
                    "10001",
                    "10001",
                    "10001",
                    "10001",
                    "10001",
                    "01110"
                ),
                inboxColor
            ),
            // X (same 7-row height)
            Pair(
                listOf(
                    "10001",
                    "10001",
                    "01010",
                    "00100",
                    "01010",
                    "10001",
                    "10001"
                ),
                inboxColor
            )
        )
    }

    // Gentle, light pulsing glow animation
    val infiniteTransition = rememberInfiniteTransition(label = "titleGlowPulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.92f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.graphicsLayer {
            alpha = pulseAlpha
        }
    ) {
        glyphs.forEach { (matrix, color) ->
            if (color == Color.Transparent) {
                Spacer(modifier = Modifier.width(10.dp))
            } else {
                Column(modifier = Modifier.padding(horizontal = 2.dp)) {
                    matrix.forEach { rowStr ->
                        Row {
                            rowStr.forEach { char ->
                                val isFilled = char == '1'
                                Box(
                                    modifier = Modifier
                                        .size(pixelSizeDp.dp)
                                        .padding(0.4.dp)
                                        .background(
                                            if (isFilled) color else Color.Transparent,
                                            RoundedCornerShape(0.5.dp)
                                        )
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Large pixel-art Zero (0) with diagonal slash for center of the screen when inbox hits 0.
 */
@Composable
fun BigPixelZero(
    color: Color,
    pixelSizeDp: Float = 14f
) {
    val zeroMatrix = listOf(
        "011110",
        "100011",
        "100101",
        "101001",
        "110001",
        "100001",
        "011110"
    )

    Column(
        modifier = Modifier.padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        zeroMatrix.forEach { rowStr ->
            Row {
                rowStr.forEach { char ->
                    val isFilled = char == '1'
                    Box(
                        modifier = Modifier
                            .size(pixelSizeDp.dp)
                            .padding(1.dp)
                            .background(
                                if (isFilled) color else Color.Transparent,
                                RoundedCornerShape(1.dp)
                            )
                    )
                }
            }
        }
    }
}
