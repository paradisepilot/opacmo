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
var showHelpMessagesElement = new Element('div#helpmessages', { 'class': 'optionsswitch' });
var aboutSlider = null;
var aboutSwitch = new Element('div#aboutswitch');
var caseSwitch = false;
var caseSwitchElement = new Element('div#caseswitch', { 'class': 'optionsswitch' });
var helperSliders = {};

var queryOverText = null;
var suggestionSpinner = null;

var workaroundHtmlTable = null;
var workaroundHtmlTableRow = null;

var suggestionTableCounter = 0;
var suggestionTables = {};
var suggestionColumns = {};

var processQueryTimeOutID = 0;

var selectedEntities = {};

var column2Header = {
		'titles':	'Title',
		'pmcid':        'PMC ID',
		'entrezname':   'Entrez Gene',
		'entrezid':     'Entrez ID',
		'entrezscore':  'bioknack Score',
		'speciesname':  'Species Name',
		'speciesid':    'Species ID',
		'speciesscore': 'bioknack Score',
		'oboname':      'OBO Term Name',
		'oboid':        'OBO ID',
		'oboscore':     'bioknack Score'
	};

var header2ResultHeader = {
		'PMC ID':	'PMC ID',
		'Entrez Gene':	'Genes:',
		'Entrez ID':	'Genes:',
		'Species Name':	'Species:',
		'Species ID':	'Species:',
		'OBO Term Name':'Terms:',
		'OBO ID':	'Terms:'
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

				var id = makeTable($('suggestioncontainer'), partialResult, [column2Header[result]], false);

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

			if (response.download) {
				var type = response.download.replace(/^[^.]+\./, '')
				var link = new Element('a#downloadlink' + type, {
					'class': 'downloadlink',
					'href': 'http://opacmo.org/' + response.download,
					'html': '&nbsp;Download Link&nbsp;',
					'target': '_blank'
				});
				link.inject($('download' + type));
				new Fx.Slide('downloadlink' + type, { mode: 'vertical', duration: 'short' }).hide().toggle();

				return;
			}

			$('resultcontainer').empty();

			makeDownload('tsv');
			makeDownload('xls');

			for (var pmcid in response.result) {
				var pmcInfo = new Element('div#pmc' + pmcid, {
					'class': 'pmccontainer'
				});
				var title = new Element('div#title' + pmcid, {
					'class': 'titlecontainer'
				});
				var genes = new Element('div#genes' + pmcid, {
					'class': 'genescontainer'
				});
				var species = new Element('div#species' + pmcid, {
					'class': 'speciescontainer'
				});
				var terms = new Element('div#terms' + pmcid, {
					'class': 'termscontainer'
				});
				for (var i in response.result[pmcid]) {
					var batch = response.result[pmcid][i];

					if (!batch.selection)
						continue;

					if (batch.selection[0] == 'titles') {
						var clazz = 'resulttitle';
						if (selectedEntities['PMC ID%' + batch.result[0][0]])
							clazz = 'resulttitle-selected';

						var entity = new Element('a', {
							'class': clazz,
							'href': 'http://www.ncbi.nlm.nih.gov/pmc/articles/' + batch.result[0][0],
							'target': '_blank'
						});

						entity.set('html', batch.result[0][0] + '&nbsp;&mdash;&nbsp;' + batch.result[0][2]);
						entity.inject(title);

						//title.set('html', batch.result[0][2]);
					} else if (batch.selection[0] == 'entrezname') {
						for (var row = 0; row < batch.result.length; row++)
							makeRow('Genes:', 'resultlink', row, genes, batch.result[row][0], batch.result[row][1], batch.result[row][2], 'http://www.ncbi.nlm.nih.gov/gene/' + batch.result[row][1]);
					} else if (batch.selection[0] == 'speciesname') {
						for (var row = 0; row < batch.result.length; row++)
							makeRow('Species:', 'resultlink', row, species, batch.result[row][0], batch.result[row][1], batch.result[row][2], 'http://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + batch.result[row][1]);
					} else if (batch.selection[0] == 'oboname') {
						for (var row = 0; row < batch.result.length; row++) {
							var linkOut = 'http://www.ebi.ac.uk/ontology-lookup/browse.do?ontName=DOID&termId=DOID%3A' + batch.result[row][1].replace(/^[^:]+:/, '');
							if (batch.result[row][1].indexOf('GO:') == 0)
								linkOut = 'http://amigo.geneontology.org/cgi-bin/amigo/term_details?term=' + batch.result[row][1];
							makeRow('Terms:', 'resultlink', row, terms, batch.result[row][0], batch.result[row][1], batch.result[row][2], linkOut);
						}
					}
				}
				title.inject(pmcInfo);
				genes.inject(pmcInfo);
				species.inject(pmcInfo);
				terms.inject(pmcInfo);
				pmcInfo.inject($('resultcontainer'));
			}
		}
	});

function makeDownload(format) {
	var downloadButton = new Element('div#download' + format, {
		'class': 'downloadbutton',
		'html': format.toUpperCase()
	});
	downloadButton.addEvent('click', function() {
		downloadButton.removeEvents();
		downloadButton.set('class', 'downloadbutton-selected');
		runConjunctiveQuery(format);
	});
	downloadButton.inject($('resultdownloads'));
}

function makeRow(header, clazz, row, container, name, id, score, linkOut) {
	if (row == 0) {
		var label = new Element('span', { 'class': 'linkedlabel' })
		label.appendText(header);
		label.inject(container);
	}

	if (selectedEntities[header + '%' + name] || selectedEntities[header + '%' + id])
		clazz = clazz + '-selected';

	clipped_score = score < 5 ? 5 : score;
	clipped_score = score > 15 ? 15 : clipped_score;

	var entity = new Element('a', {
		'class': clazz,
		'style': 'border-color: #' + (clipped_score).toString(16) + '55555;',
		'href': linkOut,
		'target': '_blank'
	});

	entity.set('html', '&nbsp;' + name.replace(/ /g, '&nbsp;') +
		'&nbsp;(' + id + '&nbsp;/&nbsp;score&nbsp;' + score + ') ');
	entity.inject(container);
}

function presentSuggestion(title) {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return false;

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (table && table.getSelected().length != 0 &&
			table.getHead().getChildren()[0].innerHTML == title)
			return true;
	}

	return false;
}

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
				'color': '#999999'
			});
		}
	}
}

function discardSelection() {

}

function makeTable(container, matrix, headers, result) {
	var options = {
		properties: {
			border: 0,
			cellspacing: 5
		},
		selectable: true,
		allowMultiSelect: false
	};

	if (result) {
		options['rows'] = matrix.result;
		headers = [];

		if (!headers)
			return;

		if (headers[0] == 'titles')
			headers = [
				column2Header['pmcid'],
				column2Header['pmcid'],
				column2Header['titles']
			];
		else
			for (var column in matrix.selection)
				headers.push(column2Header[matrix.selection[column]]);
	} else
		options['rows'] = matrix;

	if (headers) {
		if (headers.length == 1 && presentSuggestion(headers[0]))
			return;

		options['headers'] = headers;
	}

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
			runConjunctiveQuery();
		});

		fadeOut.start({
			opacity: [ 1, 0 ]
		});
	});
	closeButton.addEvent('mouseover', function() {
		closeButton.setProperty('src', '/images/red/x_alt_12x12.png');
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
		entrezname: query
	};

	if (query.toUpperCase().match(/^(P|PM|PMC|PMC\d+)$/))
		yoctogiClauses['pmcid'] = query;
	if (query.match(/^[a-zA-Z].*$/)) {
		yoctogiClauses['speciesname'] = query;
		yoctogiClauses['oboname'] = query;
	}
	if (query.match(/^\d+$/)) {
		yoctogiClauses['entrezid'] = query;
		yoctogiClauses['speciesid'] = query;
	}
	if (query.toUpperCase().match(/^(D|DO|DO:|DOI:|DOID:|DOID:\d+|G|GO|GO:|GO:\d+)$/))
		yoctogiClauses['oboid'] = query;

	var yoctogiOptions = { like: true, batch: true, distinct: true, caseinsensitive: !caseSwitch }

	var yoctogiRequest = { clauses: yoctogiClauses, options: yoctogiOptions  }

	suggestionSpinner.show();
	suggestionRequest.send(JSON.encode(yoctogiRequest));
}

function runConjunctiveQuery(format) {
	var suggestions = $('suggestioncontainer').getChildren();

	if (!suggestions)
		return;

	selectedEntities = {};

	var yoctogiClausesLength = 0;
	var yoctogiClauses = {};

	for (var i = 0; i < suggestions.length; i++) {
		var table = suggestionTables[suggestions[i].id];

		if (table && table.getSelected().length > 0) {
			var selectedTDs = table.getSelected()[0].getChildren();

			for (var j = 0; j < selectedTDs.length; j++) {
				yoctogiClausesLength++;
				yoctogiClauses[suggestionColumns[suggestions[i].id]] = selectedTDs[j].innerHTML;
				selectedEntities[header2ResultHeader[table.head.getChildren()[0].innerHTML] +
					'%' + selectedTDs[j].innerHTML] = true;;
			}
		}
	}

	if (yoctogiClausesLength == 0)
		return;

	var yoctogiOptions = { distinct: true, notempty: 0, orderby: 2, orderdescending: true }

	if (format)
		yoctogiOptions['format'] = format

	var yoctogiRequest = {
		aggregate: {
			pmcid: [
				['entrezname', 'entrezid', 'entrezscore'],
				['speciesname','speciesid','speciesscore'],
				['oboname', 'oboid', 'oboscore']
			]
		},
		clauses: yoctogiClauses,
		dimensions: { titles: 'pmcid' },
		options: yoctogiOptions
	}

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

	showHelpMessagesElement.inject($('options'));
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

	caseSwitchElement.inject($('options'));
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

