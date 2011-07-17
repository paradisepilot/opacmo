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
var aboutSlider = null;
var aboutSwitch = new Element('div#aboutswitch');
var caseSwitch = false;
var caseSwitchElement = new Element('div#caseswitch');
var helperSliders = {};

var queryOverText = null;
var suggestionSpinner = null;

var workaroundHtmlTable = null;
var workaroundHtmlTableRow = null;

var suggestionTableCounter = 0;
var suggestionTables = {};
var suggestionColumns = {};

var processQueryTimeOutID = 0;

var column2Header = {
		'pmcid':       'PMC ID',
		'entrezname':  'Entrez Gene',
		'entrezid':    'Entrez ID',
		'speciesname': 'Species Name',
		'speciesid':   'Species ID',
		'oboname':     'OBO Term Name',
		'oboid':       'OBO ID'
	};

var suggestionRequest = new Request.JSON({
		url: 'http://opacmo.org/yoctogi.fcgi',
		link: 'cancel',
		onSuccess: function(response) {
			suggestionSpinner.hide();

			if (response.error) {
				// TODO
				alert(response['message']);
				return;
			}

			clearSuggestions();
			if (!response.result)
				return;

			for (var result in response.result) {
				var partialResult = JSON.parse(response.result[result])['result']

				if (partialResult.length == 0)
					continue;

				var id = makeTable($('suggestioncontainer'), partialResult, [column2Header[result]]);

				suggestionColumns[id] = result;
			}
		}
	});

var resultRequest = new Request.JSON({
		url: 'http://opacmo.org/yoctogi.fcgi',
		link: 'cancel',
		onSuccess: function(response) {
			if (response.error) {
				// TODO
				alert(response);
				return;
			}

			$('resultcontainer').empty();
			makeTable($('resultcontainer'), response.result, [
				'PMC ID',
				'Entrez Gene',
				'Entrez ID',
				'Entrez Score',
				'Species Name',
				'Species ID',
				'Species Score',
				'OBO Term Name',
				'OBO ID',
				'OBO Score',
				'PMC ID',
				'PMC Title'
			]);
		}
	});

function clearSuggestions() {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (!table || table.getSelected().length == 0) {
			// Get rid of suggestions that were not selected.
			delete suggestionTables[suggestions[i].id];
			delete suggestionColumns[suggestions[i].id];
			suggestions[i].dispose();
		} else if ($('c' + suggestions[i].id).getOpacity() == 0) {
			// Highlight those suggestions that were selected.
			new Fx.Morph($('c' + suggestions[i].id), { duration: 'short' }).start({
				opacity: [ 0, 1 ]
			});
			suggestionTables[suggestions[i].id].disableSelect();
			suggestions[i].getChildren()[1].morph({
				'color': '#bbbbbb'
			});
		}
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
		selectable: true,
		allowMultiSelect: false
	};

	if (headers)
		options['headers'] = headers;

	var id = 's' + suggestionTableCounter++;
	var wrapper = new Element('div#' + id);

	var closeButton = new Element('img#c' + id, {
		'class': 'closebutton',
		title: 'bla',
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

	htmlTable.addEvent('rowFocus', function(row) {
		if (workaroundHtmlTable && workaroundHtmlTable == htmlTable && workaroundHtmlTableRow == row)
			htmlTable.deselectRow(row);

		workaroundHtmlTable = null;

		$('query').value = '';
		runConjunctiveQuery();

		if (showHelpMessages)
			helperSliders['help2'].slideIn();

	});
	htmlTable.addEvent('rowUnfocus', function(row) {
		workaroundHtmlTable = htmlTable;
		workaroundHtmlTableRow = row;

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

	query = query.replace(/^ +/, '')
	query = query.replace(/ +$/, '')

	if (showHelpMessages) {
		helperSliders['help0'].slideIn();
		helperSliders['help1'].slideIn();
	}

	var yoctogiClauses = {
		pmcid: query,
		entrezid: query,
		entrezname: query,
		speciesid: query,
		speciesname: query,
		oboid: query,
		oboname: query
	};
	var yoctogiOptions = { like: true, batch: true, distinct: true, caseinsensitive: !caseSwitch }

	var yoctogiRequest = { clauses: yoctogiClauses, options: yoctogiOptions  }

	suggestionSpinner.show();
	suggestionRequest.send(JSON.encode(yoctogiRequest));
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
	var yoctogiRequest = { clauses: yoctogiClauses, dimensions: { titles: 'pmcid' }, options: yoctogiOptions  }

	resultRequest.send(JSON.encode(yoctogiRequest));
}

function updateHelpMessagesSwitch() {
	if (showHelpMessages)
		$('helpmessages').innerHTML = 'Help Messages: On&nbsp;';
	else
		$('helpmessages').innerHTML = 'Help Messages: Off';
}

function updateCaseSwitch() {
	if (caseSwitch)
		$('caseswitch').innerHTML = 'Case Sensitive Search: On&nbsp;';
	else
		$('caseswitch').innerHTML = 'Case Sensitive Search: Off';
}

$(window).onload = function() {
	aboutSwitch.inject($('header'));
	aboutSlider = new Fx.Slide('about', { mode: 'vertical', duration: 'short' }).hide();
	aboutSlider.addEvent('complete', function() {
		if (aboutSlider.open)
			$('aboutswitch').innerHTML = 'Hide About';
		else {
			$('aboutswitch').innerHTML = 'Show About';
			queryOverText.enable();
		}
	});
	aboutSwitch.addEvent('click', function() {
		$('about').style.visibility = 'visible';
		queryOverText.disable();
		aboutSlider.toggle();
	});
	$('aboutswitch').innerHTML = 'Show About';

	showHelpMessagesElement.inject($('header'));
	showHelpMessagesElement.addEvent('click', function() {
		showHelpMessages = showHelpMessages ? false : true;
		updateHelpMessagesSwitch();

		if (showHelpMessages) {
			helperSliders['help0'].slideIn();
			helperSliders['help1'].slideIn();
			helperSliders['help2'].slideIn();
		} else {
			helperSliders['help0'].slideOut();
			helperSliders['help1'].slideOut();
			helperSliders['help2'].slideOut();
		}
	});
	updateHelpMessagesSwitch();

	caseSwitchElement.inject($('querycontainer'));
	caseSwitchElement.addEvent('click', function() {
		caseSwitch = caseSwitch ? false : true;
		updateCaseSwitch();
		processQuery();
	});
	updateCaseSwitch();

	helperSliders['help0'] = new Fx.Slide('help0', { mode: 'horizontal' }).hide().toggle();
	helperSliders['help1'] = new Fx.Slide('help1', { mode: 'horizontal' }).hide();
	helperSliders['help2'] = new Fx.Slide('help2', { mode: 'horizontal' }).hide();

	$('query').addEvent('keyup', function() {
		clearTimeout(processQueryTimeOutID);
		processQueryTimeOutID = processQuery.delay(250);
	});
	queryOverText = new OverText($('query'));

	suggestionSpinner = new Spinner('suggestioncontainer');
}

