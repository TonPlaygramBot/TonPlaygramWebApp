import Foundation
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController, WKNavigationDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()
        self.bridge?.webView.navigationDelegate = self
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .backForward {
            bridge?.triggerJSEvent(eventName: "backButtonClicked", target: "window")
        }
        decisionHandler(.allow)
    }
}
