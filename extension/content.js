// Ao abrir uma página do Nutrium, pede ao background uma sincronização automática
// (o background ignora o pedido se tiver sincronizado há pouco tempo).
chrome.runtime.sendMessage({ type: "auto-sync" });
