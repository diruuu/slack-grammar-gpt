function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const onInputChange = debounce(function () {
  const openaiToken = document.getElementById('openai-token').value;
  chrome.runtime.sendMessage({ action: 'saveToken', token: openaiToken });
}, 500);

document.getElementById('openai-token').addEventListener('input', onInputChange);

chrome.runtime.sendMessage({ action: 'getToken' }, function (response) {
  if (response) {
    document.getElementById('openai-token').value = response.token || '';
  }
});
