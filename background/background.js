chrome.runtime.onInstalled.addListener(() => {
    console.log('PDF合并工具已安装');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "downloadPDF") {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
      } else {
        sendResponse({success: true, downloadId: downloadId});
      }
    });
    return true; // 保持消息通道开放以进行异步响应
  }
});
