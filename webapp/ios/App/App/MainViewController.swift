import Foundation
import Capacitor
import WebKit

@objc(MainViewController)
class MainViewController: CAPBridgeViewController, WKNavigationDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()
        self.webView?.navigationDelegate = self
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .backForward {
            triggerBackButtonShim()
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        triggerBackButtonShim()
    }

    private func triggerBackButtonShim() {
        let script = "window.Telegram?.WebApp?.BackButton?.__nativeTrigger && window.Telegram.WebApp.BackButton.__nativeTrigger();"
        self.bridge?.webView?.evaluateJavaScript(script, completionHandler: nil)
    }
}
