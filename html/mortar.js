/*
 * opacmo -- The Open Access Mortar
 *
 * For copyright and license see LICENSE file.
 *
 * Contributions:
 *   - Joachim Baran
 *
 */

var showHelpMessages = true;
var showHelpMessagesElement = new Element('div#helpmessages', { 'class': 'headerswitch' });
var helperSliders = {};

var suggestionTableCounter = 0;
var suggestionTables = {};
var suggestionColumns = {};

function clearSuggestions() {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (!table || table.getSelected().length == 0) {
			delete suggestionTables[suggestions[i].id];
			delete suggestionColumns[suggestions[i].id];
			suggestions[i].dispose();
		} else if ($('c' + suggestions[i].id).getOpacity() == 0)
			new Fx.Morph($('c' + suggestions[i].id), { duration: 'long' }).start({
				opacity: [ 0, 1 ]
			})
	}
}

function discardSelection() {

}

function makeTable(container, matrix, headers) {
	var options = {
		properties: {
			border: 0,
			cellspacing: 5
		},
		rows: matrix,
		selectable: true
	};

	if (headers)
		options['headers'] = headers;

	var id = 's' + suggestionTableCounter++;
	var wrapper = new Element('div#' + id);

	var closeButton = new Element('img#c' + id, {
		'class': 'closebutton',
		src: '/images/gray_light/x_alt_12x12.png'
	});
	closeButton.addEvent('click', function() {
		if ($('c' + id).getOpacity() != 1)
			return;

		var fadeOut = new Fx.Morph($(id), { duration: 'long' });

		fadeOut.addEvent('complete', function() {
			$(id).dispose();
		});

		fadeOut.start({
			opacity: [ 1, 0 ]
		});
	});
	closeButton.addEvent('mouseover', function() {
		closeButton.setProperty('src', '/images/cyan/x_alt_12x12.png');
	});
	closeButton.addEvent('mouseleave', function() {
		closeButton.setProperty('src', '/images/gray_light/x_alt_12x12.png');
	});
	closeButton.setOpacity(0);

	var htmlTable = new HtmlTable(options);

	htmlTable.addEvent('rowFocus', function() {
		$('query').value = '';
		runConjunctiveQuery();

		if (showHelpMessages)
			helperSliders['help1'].slideOut().chain(function() {
				helperSliders['help1'].hide();
				if (showHelpMessages)
					helperSliders['help2'].slideIn();
			});

	});
	htmlTable.addEvent('rowUnfocus', function() {
		runConjunctiveQuery();
	});

	wrapper.addClass('suggestiontable');
	closeButton.inject(wrapper);
	htmlTable.inject(wrapper);
	wrapper.inject(container);

	if (container == $('suggestioncontainer'))
		suggestionTables[id] = htmlTable;

	return id;
}

function processQuery() {
	var query = $('query').value;

	if (!query || query.length == 0)
		return;

	if (showHelpMessages)
		helperSliders['help0'].slideOut().chain(function() {
			helperSliders['help0'].hide();
			if (showHelpMessages)
				helperSliders['help1'].slideIn();
		});

	var yoctogiClauses = {
		pmcid: query,
		entrezid: query,
		gene: query,
		taxid: query,
		species: query,
		doid: query,
		disease: query,
		goid: query,
		goterm: query
	};
	var yoctogiOptions = { like: true, batch: true }

	var yoctogiRequest = { clauses: yoctogiClauses, options: yoctogiOptions  }

	new Request.JSON({
		url: 'http://173.255.227.8/yoctogi.fcgi',
		onSuccess: function(response) {
			if (response.error) {
				// TODO
				alert(response);
				return;
			}

			clearSuggestions();
			if (!response.result)
				return;

			for (var result in response.result) {
				var partialResult = JSON.parse(response.result[result])['result']

				if (partialResult.length == 0)
					continue;

				var id = makeTable($('suggestioncontainer'), partialResult, [result]);

				suggestionColumns[id] = result;
			}
		}
	}).post(JSON.encode(yoctogiRequest));
}

function runConjunctiveQuery() {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	var yoctogiClausesLength = 0;
	var yoctogiClauses = {};

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (table && table.getSelected().length > 0) {
			var selectedTDs = table.getSelected()[0].getChildren();

			for (var j = 0; j < selectedTDs.length; j++) {
				yoctogiClausesLength++;
				yoctogiClauses[suggestionColumns[suggestions[i].id]] = selectedTDs[j].innerHTML;
			}
		}
	}

	if (yoctogiClausesLength == 0)
		return;

	var yoctogiOptions = {}
	var yoctogiRequest = { clauses: yoctogiClauses, options: yoctogiOptions  }

	new Request.JSON({
		url: 'http://173.255.227.8/yoctogi.fcgi',
		onSuccess: function(response) {
			if (response.error) {
				// TODO
				alert(response);
				return;
			}

			$('resultcontainer').empty();
			makeTable($('resultcontainer'), response.result)
		}
	}).post(JSON.encode(yoctogiRequest));
}

function updateHelpMessagesSwitch() {
	if (showHelpMessages)
		$('helpmessages').innerHTML = 'Help Messages: On&nbsp;';
	else
		$('helpmessages').innerHTML = 'Help Messages: Off';
}

$(window).onload = function() {
	showHelpMessagesElement.inject($('header'));
	showHelpMessagesElement.addEvent('click', function() {
		showHelpMessages = showHelpMessages ? false : true;
		updateHelpMessagesSwitch();
	});
	updateHelpMessagesSwitch();

	helperSliders['help0'] = new Fx.Slide('help0', { mode: 'horizontal' }).hide().toggle();
	helperSliders['help1'] = new Fx.Slide('help1', { mode: 'horizontal' }).hide();
	helperSliders['help2'] = new Fx.Slide('help2', { mode: 'horizontal' }).hide();

	$('query').addEvent('keyup', processQuery);
	new OverText($('query'));
}

