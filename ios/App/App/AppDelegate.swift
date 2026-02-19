import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Set the root view and webview background to match the app's blue,
        // so iOS safe-area insets (status bar, home indicator) show blue instead of white.
        let blue = UIColor(red: 0.0, green: 0.216, blue: 0.682, alpha: 1.0) // #0037ae

        DispatchQueue.main.async { [weak self] in
            guard let window = self?.window else { return }
            window.backgroundColor = blue

            if let rootVC = window.rootViewController {
                rootVC.view.backgroundColor = blue

                // Find the WKWebView inside the Capacitor view hierarchy
                func findWebView(in view: UIView) -> UIView? {
                    if NSStringFromClass(type(of: view)).contains("WKWebView") {
                        return view
                    }
                    for sub in view.subviews {
                        if let found = findWebView(in: sub) { return found }
                    }
                    return nil
                }

                if let webView = findWebView(in: rootVC.view) {
                    webView.backgroundColor = blue
                    webView.isOpaque = false
                    // The scroll view behind the web content
                    if let scrollView = webView.subviews.first(where: { $0 is UIScrollView }) as? UIScrollView {
                        scrollView.backgroundColor = blue
                    }
                }
            }
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
