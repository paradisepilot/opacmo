/*
 * opacmo -- The Open Access Mortar
 *
 * For copyright and license see LICENSE file.
 *
 * Contributions:
 *   - Joachim Baran
 *
 */

var updateInProgress = false;

var showHelpMessages = true;
var showHelpMessagesElement = new Element('div#helpmessages', { 'class': 'optionsswitch' });
var aboutSlider = null;
var aboutSwitch = new Element('div#aboutswitch', { 'class': 'headerbutton' } );
var releaseSlider = null;
var releaseSwitch = new Element('div#releaseswitch');
var caseSwitch = false;
var caseSwitchElement = new Element('div#caseswitch', { 'class': 'optionsswitch' });
var helperSliders = {};
var noResultsMessage = new Element('span', { 'class': 'noresultsfound', 'html': 'No results found.' });

var browseMessage = new Element('span', { 'class': 'browsetext', 'html': '' });
var browseLeft = new Element('img', { 'class': 'browsebutton', 'src': '/images/gray_dark/arrow_left_12x12.png' });
var browseRight = new Element('img', { 'class': 'browsebutton', 'src': '/images/gray_dark/arrow_right_12x12.png' });
var browseOffset = 0;
var yoctogiAggregateLimit = 25;

var sortedMessage = new Element('span', { 'class': 'sortedtext', 'html': '<br />Sorted by score of: ' });
var sortedByEntrez = new Element('a', { 'class': 'sortedbutton', 'html': 'Entrez Genes' });
var sortedBySpecies = new Element('a', { 'class': 'sortedbutton', 'html': 'Species' });
var sortedByOBO = new Element('a', { 'class': 'sortedbutton', 'html': 'OBO Terms' });
var sortedSelected = 'entrezscore';

var queryOverText = null;
var suggestionSpinner = null;
var resultSpinner = null;

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
		url: 'http://www.opacmo.org/yoctogi.fcgi',
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
		url: 'http://www.opacmo.org/yoctogi.fcgi',
		link: 'cancel',
		onSuccess: function(response) {
			resultSpinner.hide();

			if (response.error) {
				// TODO
				alert(response);
				return;
			}

			if (response.download) {
				var type = response.download.replace(/^[^.]+\./, '')
				var link = new Element('a#downloadlink' + type, {
					'class': 'downloadlink',
					'href': 'http://www.opacmo.org/' + response.download,
					'html': '&nbsp;Download Link&nbsp;',
					'target': '_blank'
				});
				link.inject($('download' + type));
				new Fx.Slide('downloadlink' + type, { mode: 'vertical', duration: 'short' }).hide().toggle();

				return;
			}

			$('resultdownloads').empty();
			$('resultbrowse').empty();
			$('resultcontainer').empty();

			makeDownload('tsv');
			makeDownload('xls');

			if (response.count > 0) {
				var pmcidsReturned = 0;
				browseMax = response.count;

				for (var pmcid in response.result)
					pmcidsReturned++;

				browseMessage.set('html', 'Showing results ' + (browseOffset + 1) + ' to ' + (browseOffset + pmcidsReturned) + ' of ' + browseMax + ' total');
				browseMessage.inject($('resultbrowse'));
				browseLeft.inject($('resultbrowse'));
				browseRight.inject($('resultbrowse'));

				sortedMessage.inject($('resultbrowse'));
				sortedByEntrez.inject($('resultbrowse'));
				sortedBySpecies.inject($('resultbrowse'));
				sortedByOBO.inject($('resultbrowse'));

				updateSortedButtons();
			}

			var continuousNumber = browseOffset + 1;

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

					if (batch.selection[0] == 'pmcid') {
						new Element('span', { 'html': '' + (continuousNumber++) + '.&nbsp;' }).inject(title);

						var clazz = 'resulttitle';
						if (selectedEntities['PMC ID%' + batch.result[0][0]])
							clazz = 'resulttitle-selected';

						var entity = new Element('a', {
							'class': clazz,
							'href': 'http://www.ncbi.nlm.nih.gov/pmc/articles/' + batch.result[0][0],
							'target': '_blank'
						});

						entity.set('html', batch.result[0][0] + '&nbsp;&mdash;&nbsp;' + batch.result[0][1]);
						entity.inject(title);
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

			if (response.count == 0)
				noResultsMessage.inject($('resultcontainer'));
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

	score = parseInt(score);
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
				column2Header['titles']
			];
		else
			for (var column in matrix.selection)
				headers.push(column2Header[matrix.selection[column]]);
	} else
		options['rows'] = matrix;

	if (headers) {
		// TODO It is not possible to set multiple constraints on
		// a single column.
		if (headers.length == 1 && presentSuggestion(headers[0]))
			return;

		options['headers'] = headers;
	}

	var id = 's' + suggestionTableCounter++;
	var wrapper = new Element('div#' + id);

	var closeButton = new Element('img#c' + id, {
		'class': 'closebutton',
		'src': '/images/gray_light/x_alt_12x12.png'
	});
	closeButton.addEvent('click', function() {
		if ($('c' + id).getOpacity() != 1)
			return;

		var fadeOut = new Fx.Morph($(id), { duration: 'long' });

		fadeOut.addEvent('complete', function() {
			$(id).dispose();
			browseOffset = 0;
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

	var htmlTable = new HtmlTable(options);

	htmlTable.addEvent('rowFocus', function(row) {
		if (workaroundHtmlTable && workaroundHtmlTable == htmlTable && workaroundHtmlTableRow == row)
			htmlTable.deselectRow(row);

		workaroundHtmlTable = null;

		$('query').value = '';
		browseOffset = 0;
		runConjunctiveQuery();

		if (showHelpMessages)
			helperSliders['help2'].slideIn();

	});
	htmlTable.addEvent('rowUnfocus', function(row) {
		workaroundHtmlTable = htmlTable;
		workaroundHtmlTableRow = row;

		browseOffset = 0;
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

	if (!query || query.length < 2)
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

	if ($('secondstage').getOpacity() == 0) {
		new Fx.Morph($('secondstage'), { duration: 'short' }).start({ opacity: [ 0, 1 ] });
	}

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
				var currentAssignment = yoctogiClauses[suggestionColumns[suggestions[i].id]];
				if (!currentAssignment)
					yoctogiClauses[suggestionColumns[suggestions[i].id]] = [ selectedTDs[j].innerHTML ];
				else {
					currentAssignment.push(selectedTDs[j].innerHTML);
					yoctogiClauses[suggestionColumns[suggestions[i].id]] = currentAssignment;
				}
				selectedEntities[header2ResultHeader[table.head.getChildren()[0].innerHTML] +
					'%' + selectedTDs[j].innerHTML] = true;;
			}
		}
	}

	if (!format) {
		$('resultdownloads').empty();
		$('resultbrowse').empty();
		$('resultcontainer').empty();

		nextSortedSelected = [];
		if (yoctogiClauses['entrezname'] || yoctogiClauses['entrezid']) {
			sortedByEntrez.set('style', 'display: inline;');
			nextSortedSelected.push('entrezscore');
		} else
			sortedByEntrez.set('style', 'display: none;');
		if (yoctogiClauses['speciesname'] || yoctogiClauses['speciesid']) {
			sortedBySpecies.set('style', 'display: inline;');
			nextSortedSelected.push('speciesscore');
		} else
			sortedBySpecies.set('style', 'display: none;');
		if (yoctogiClauses['oboname'] || yoctogiClauses['oboid']) {
			sortedByOBO.set('style', 'display: inline;');
			nextSortedSelected.push('oboscore');
		} else
			sortedByOBO.set('style', 'display: none;');

		if (nextSortedSelected.indexOf(sortedSelected) < 0 && nextSortedSelected.length > 0)
			sortedSelected = nextSortedSelected[0];
	}

	if (yoctogiClausesLength == 0)
		return;

	if (!format) {
		if ($('thirdstage').getOpacity() == 0) {
			new Fx.Morph($('thirdstage'), { duration: 'short' }).start({ opacity: [ 0, 1 ] });
		}
	}

	resultSpinner.show();

	var yoctogiOptions = {
		distinct: true,
		notempty: 0,
		orderby: 2,
		orderdescending: true,
		count: true,
		offset: browseOffset,
		limit: yoctogiAggregateLimit,
		aggregateorder: [ sortedSelected ],
		aggregateorderdescending: true
	};

	if (format)
		yoctogiOptions['format'] = format;

	var yoctogiRequest = {
		aggregate: {
			pmcid: [
				['entrezname', 'entrezid', 'entrezscore'],
				['speciesname','speciesid','speciesscore'],
				['oboname', 'oboid', 'oboscore']
			]
		},
		clauses: yoctogiClauses,
		dimensions: { titles: { pmcid: [ 'pmctitle' ] } },
		options: yoctogiOptions
	};

	resultRequest.send(JSON.encode(yoctogiRequest));
}

function updateSortedButtons() {
	sortedByEntrez.set('class', 'sortedbutton');
	sortedBySpecies.set('class', 'sortedbutton');
	sortedByOBO.set('class', 'sortedbutton');

	if (sortedSelected == 'entrezscore')
		sortedByEntrez.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'speciesscore')
		sortedBySpecies.set('class', 'sortedbutton-selected');
	else if (sortedSelected == 'oboscore')
		sortedByOBO.set('class', 'sortedbutton-selected');
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
	$('secondstage').setOpacity('0');
	$('thirdstage').setOpacity('0');

	aboutSwitch.inject($('header'));
	aboutSlider = new Fx.Slide('about', { mode: 'vertical', duration: 'short' }).hide();
	aboutSlider.addEvent('complete', function() {
		if (aboutSlider.open) {
			releaseSlider.slideOut();
			$('aboutswitch').innerHTML = 'Hide&nbsp;';
		} else {
			$('aboutswitch').innerHTML = 'About';
			queryOverText.enable();
		}
	});
	aboutSwitch.addEvent('click', function() {
		$('about').style.visibility = 'visible';
		queryOverText.disable();
		aboutSlider.toggle();
	});
	$('aboutswitch').innerHTML = 'About';

	releaseSwitch.inject($('header'));
	releaseSlider = new Fx.Slide('release', { mode: 'vertical', duration: 'short' }).hide();
	releaseSlider.addEvent('complete', function() {
		if (releaseSlider.open) {
			aboutSlider.slideOut();
			$('releaseswitch').innerHTML = 'Hide';
		} else {
			$('releaseswitch').innerHTML = 'Release Notes &amp; Downloads';
			queryOverText.enable();
		}
	});
	releaseSwitch.addEvent('click', function() {
		$('release').style.visibility = 'visible';
		queryOverText.disable();
		releaseSlider.toggle();
	});
	$('releaseswitch').innerHTML = 'Release Notes &amp; Downloads';

	new Fx.Accordion($('release'), '#release h3', '#release .releasenote');

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

	helperSliders['help0'] = new Fx.Slide('help0', { mode: 'horizontal' }).hide();
	helperSliders['help1'] = new Fx.Slide('help1', { mode: 'horizontal' }).hide();
	helperSliders['help2'] = new Fx.Slide('help2', { mode: 'horizontal' }).hide();

	if (updateInProgress) {
		$('query').disabled = true;

		new Element('div', {
			'class': 'notificationimportant',
			html: 'The database is currently being updated. Please check back later.'
		}).inject($('notifications'));

		$('query').alt = '--- disabled due to update ---';
	} else
		helperSliders['help0'].toggle();

	$('query').addEvent('keyup', function() {
		clearTimeout(processQueryTimeOutID);
		processQueryTimeOutID = processQuery.delay(250);
	});
	queryOverText = new OverText($('query'));

	suggestionSpinner = new Spinner('suggestioncontainer');
	resultSpinner = new Spinner('resultcontainer');

	browseLeft.addEvent('click', function() {
		if (browseOffset - yoctogiAggregateLimit >= 0)
			browseOffset -= yoctogiAggregateLimit;
		runConjunctiveQuery();
	});
	browseRight.addEvent('click', function() {
		if (browseOffset + yoctogiAggregateLimit < browseMax)
			browseOffset += yoctogiAggregateLimit;
		runConjunctiveQuery();
	});

	sortedByEntrez.addEvent('click', function() {
		if (sortedSelected == 'entrezscore')
			return;
		sortedSelected = 'entrezscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedBySpecies.addEvent('click', function() {
		if (sortedSelected == 'speciesscore')
			return;
		sortedSelected = 'speciesscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
	sortedByOBO.addEvent('click', function() {
		if (sortedSelected == 'oboscore')
			return;
		sortedSelected = 'oboscore';
		updateSortedButtons();
		runConjunctiveQuery();
	});
}

