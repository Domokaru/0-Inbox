import com.google.android.gms.auth.UserRecoverableAuthException
import com.google.android.gms.auth.GooglePlayServicesAvailabilityException

fun test(current: Throwable?) {
    when (current) {
        is UserRecoverableAuthException -> println("1")
        is GooglePlayServicesAvailabilityException -> println("2")
    }
}
