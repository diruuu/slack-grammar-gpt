function removeSpecialCharsAtStart(sentence) {
  // The regular expression pattern:
  // ^: matches the start of the string.
  // [^a-zA-Z0-9]: matches any character that is NOT an alphanumeric character.
  // *: matches zero or more occurrences of the preceding character.
  const regex = /^[^a-zA-Z0-9]*/;
  
  // Use replace() to remove the special characters.
  return sentence.replace(regex, '');
}

async function correctGrammar(chatMessage, openaiToken) {
  const prompt = `Please translate the sentence after first @ to grammatically correct non-formal English: @ ${chatMessage}`;
  const vars = {
    prompt: prompt,
    max_tokens: 500,
    n: 1,
    stop: null,
    temperature: 0,
    model: "text-davinci-003",
    stream: false,
  }
  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiToken}`,
    },
    body: JSON.stringify(vars),
  });

  
  const data = await response.json();
  if (data.error) {
    return {
      error: true,
      message: data.error.message
    }
  }
  
  const correctedText = data.choices && data.choices[0] && data.choices[0].text.trim();

  const fixedText = removeSpecialCharsAtStart(correctedText);

  return {
    error: false,
    message: fixedText
  };
}

function getOpenaiTokenFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('openaiToken', function (data) {
      resolve(data.openaiToken);
    });
  });
}

const handleCorrectGrammar = async (value, sendResponse) => {
  if (value && value !== "") {
    const openaiToken = await getOpenaiTokenFromStorage();
    const result = await correctGrammar(value, openaiToken);
    sendResponse(result); 
  } else {
    sendResponse({
      error: true,
      message: "Text value is empty"
    }); 
  }
}

const handleGetToken = async (sendResponse) => {
  const openaiToken = await getOpenaiTokenFromStorage();
  sendResponse({ token: openaiToken });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToken') {
    chrome.storage.sync.set({ openaiToken: request.token }, function () {
      // console.log('Token saved');
    });
  } else if (request.action === 'getToken') {
    handleGetToken(sendResponse);
    return true;
  } else if (request.action === 'correctGrammar') {
    handleCorrectGrammar(request.value, sendResponse)
    return true;
  } else {
    return true;
  }
});