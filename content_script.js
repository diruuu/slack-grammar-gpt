class GrammarCorrector {
  constructor() {
    this.buttonHTML = `<button class="c-button-unstyled c-icon_button c-icon_button--size_small c-wysiwyg_container__button c-wysiwyg_container__button--composer_active c-icon_button--default custom-button" data-qa="texty_composer_button" tabindex="-1" aria-label="Formatting" aria-expanded="true" delay="500" data-sk="tooltip_parent" type="button"><svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" height="20" width="20"><path class="button-magic-path" d="M248,152a8,8,0,0,1-8,8H224v16a8,8,0,0,1-16,0V160H192a8,8,0,0,1,0-16h16V128a8,8,0,0,1,16,0v16h16A8,8,0,0,1,248,152ZM64,68H76V80a8,8,0,0,0,16,0V68h12a8,8,0,0,0,0-16H92V40a8,8,0,0,0-16,0V52H64a8,8,0,0,0,0,16ZM184,192h-8v-8a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16Zm-2.3-74.3L75.3,224a15.9,15.9,0,0,1-22.6,0L32,203.3a15.9,15.9,0,0,1,0-22.6L180.7,32a16.1,16.1,0,0,1,22.6,0L224,52.7a15.9,15.9,0,0,1,0,22.6l-42.3,42.4ZM155.3,80,176,100.7,212.7,64h0L192,43.3Z" fill="currentColor"/></svg></button>`;
    this.addButtonToInputForm(this.buttonHTML);
    this.observe();
    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
  }

   parseHTMLString(htmlString) {
    // Helper function to recursively parse nodes
    function parseNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const textNodes = Array.from(node.childNodes).filter(
          (childNode) => childNode.nodeType === Node.TEXT_NODE && childNode.textContent.trim() !== ''
        );

        if (textNodes.length > 0) {
          const isCodeBlock = node.tagName.toLowerCase() === "div" && node.className === "ql-code-block";
          return {
            tag: node.tagName.toLowerCase(),
            className: node.className,
            children: [],
            text: isCodeBlock ? node.textContent : node.textContent.trim(),
          };
        }

        const children = Array.from(node.children).map(parseNode);

        if (children.length > 0) {
          return {
            tag: node.tagName.toLowerCase(),
            className: node.className,
            children,
          };
        } else {
          return {
            tag: node.tagName.toLowerCase(),
            className: node.className,
            children: [],
          };
        }
      }
    }

    // Create a temporary element to hold the HTML string
    const tempElement = document.createElement('div');
    tempElement.innerHTML = htmlString;

    // Get the root's children
    const rootChildren = Array.from(tempElement.children);

    // Parse the root's children and filter out any null values
    const parsedElements = rootChildren.map(parseNode).filter(Boolean);

    return parsedElements;
  }

  async resembleHTML(json, parentElement = null) {
    if (!parentElement) {
      parentElement = document.createElement('div');
    }

    for (const elementData of json) {
      const element = document.createElement(elementData.tag);
      element.className = elementData.className;

      if (elementData.text) {
        if (
          elementData.tag === 'code' ||
          (elementData.tag === 'div' && elementData.className === 'ql-code-block')
        ) {
          element.textContent = elementData.text;
        } else {
          const correctedText = await this.correctGrammar(elementData.text);
          element.textContent = correctedText;
        }
      } else {
        await this.resembleHTML(elementData.children, element);
      }

      parentElement.appendChild(element);
    }

    return parentElement.innerHTML;
  }

  correctHtmlGrammar(htmlString) {
    const json = this.parseHTMLString(htmlString);
    const html = this.resembleHTML(json);
    return html;
  }

  ensureFullStop(str) {
    if (typeof str !== 'string') {
      throw new Error('Input must be a string');
    }

    if (str.length === 0) {
      return '.';
    }

    const lastChar = str[str.length - 1];
    const allowedEndings = /[a-zA-Z0-9]/;
    const allowedEndingChars = /[.?:!\[\]\{\}\(\)]/;

    if (allowedEndingChars.test(lastChar)) {
      return str;
    } else if (allowedEndings.test(lastChar)) {
      return str + '.';
    } else {
      return str.slice(0, -1) + '.';
    }
  }

  async correctGrammar(textString) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'correctGrammar',
        value: this.ensureFullStop(textString)
      }, function (response) {
        if (response.error) {
          reject(new Error(response.message));
          return;
        }
        resolve(response.message || '');
      });
    });
  }

  addButtonToInputForm(buttonHTML) {
    const that = this;
    $('.c-wysiwyg_container:not(.custom-button-processed)').each(function () {
      const $buttonsDiv = $(this).find('.c-texty_buttons');
      if (!$buttonsDiv.find('.custom-button').length) {
        const $newButton = $(buttonHTML);
        $newButton.on('click', async () => {
          try {
            const $editor = $(this).closest('.c-wysiwyg_container').find('.ql-editor');
            const html = `${$editor.html()}`;
            $newButton.find(".button-magic-path").attr("fill", "yellow");
            const result = await that.correctHtmlGrammar(html);
            if (result && result !== "") {
              $editor.html(result);
            }
          } catch (error) {
            console.error(error);
            alert(error.message);
          } finally {
            $newButton.find(".button-magic-path").attr("fill", "currentColor");
          }
        });
        $buttonsDiv.append($newButton);
      }
      $(this).addClass('custom-button-processed');
    });
  }

  observe() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const $mutationTarget = $(mutation.target);
        if ($mutationTarget.hasClass('c-wysiwyg_container') && !$mutationTarget.hasClass('custom-button-processed')) {
          this.addButtonToInputForm(this.buttonHTML);
        } else {
          const $matchingChildren = $mutationTarget.find('.c-wysiwyg_container:not(.custom-button-processed)');
          if ($matchingChildren.length > 0) {
            this.addButtonToInputForm(this.buttonHTML);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

new GrammarCorrector();