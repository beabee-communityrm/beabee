/* global $, document, formSchema, formResponses */

(function () {
  var $form = $('#form');
  var $container = $('.js-response-container');
  var $responseNo = $('.js-response-no');
  var responseTemplate = $('.js-response-template').html();

  Formio.createForm($form.get(0), formSchema, {template: 'bootstrap3', readOnly: true}).then(function (form) {
    var currentResponseNo = 0;

    function renderResponse(responseNo, response) {
      return form.setSubmission({data: response.answers}).then(function () {
        const context = {
            no: responseNo + 1,
            date: response.updatedAtText,
            type: response.member ? 'Member' : 'Guest',
            user: response.member
              ? '<a href="/members/' + response.member.id + '">' +
                response.member.firstname + ' ' + response.member.lastname +
                '</a>'
              : response.guestName + '(' + response.guestEmail + ')'
        };

        $newForm = $form.clone().attr('id', 'response' + responseNo).removeClass('hidden');
        $newForm.find('[name]').attr('name', function (i, name) {
          return 'response' + responseNo + name;
        });
        
        var $html = $(Object.keys(context).reduce(
          function (html, key) { return html.replace('{' + key + '}', context[key]); },
          responseTemplate
        ));
        $html.find('.js-response-form').append($newForm);
        $container.append($html);
      });
    }

    function setResponse(responseNo) {
      var response = formResponses[responseNo];
      if (response) {
        $container.html('');
        renderResponse(responseNo, response).then(function () {
          $responseNo.val(responseNo + 1);
          currentResponseNo = responseNo;
        })
      }
    }

    function changeResponse(inc) {
      currentResponseNo = Math.min(formResponses.length - 1, Math.max(0, currentResponseNo + inc));
      setResponse(currentResponseNo);
    }

    $('.js-step-response').click(function () {
      changeResponse(Number(this.value));
    });
    $('.js-set-response').on('click input', function () {
      setResponse(Number(this.value) - 1);
    });

    function renderAll(i, responses) {
      if (responses.length === 0) return;
      renderResponse(i, responses[0]).then(function () {
        renderAll(i + 1, responses.slice(1));
      })
    }

    $('.js-show-all-responses').change(function (evt) {
      if (evt.target.checked) {
        $container.html('');
        renderAll(0, formResponses);
      } else {
        setResponse(currentResponseNo);
      }
    });

    // Set initial state
    $('.js-show-all-responses').change();
  });
})();
