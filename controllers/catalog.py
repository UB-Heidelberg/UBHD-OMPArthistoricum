# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

import os
from operator import itemgetter
from ompdal import OMPDAL

def series():
    abstract, author, cleanTitle, subtitle = '', '', '', ''
    locale = 'de_DE'
    if session.forced_language == 'en':
        locale = 'en_US'
    ignored_submissions =  myconf.take('omp.ignore_submissions') if myconf.take('omp.ignore_submissions') else -1
    
    if request.args == []:
      redirect( URL('home', 'index'))
    series = request.args[0]
    
    query = ((db.submissions.context_id == myconf.take('omp.press_id'))  &  (db.submissions.submission_id!=ignored_submissions) & (db.submissions.status == 3) & (
        db.submission_settings.submission_id == db.submissions.submission_id) & (db.submission_settings.locale == locale) & (db.submissions.context_id==db.series.press_id) & (db.series.path==series) & (db.submissions.context_id == myconf.take('omp.press_id')) & (db.submissions.series_id==db.series.series_id) &(db.submissions.context_id==db.series.press_id) & (db.series.path==series))
    submissions = db(query).select(db.submission_settings.ALL,orderby=db.submissions.submission_id)
    submissions = db(query).select(db.submission_settings.ALL,orderby=db.submissions.series_position|~db.submissions.date_submitted)
    subs = {}

    series_title = ""
    series_subtitle = ""
    rows = db(db.series.path == series).select(db.series.series_id)
    if len(rows) == 1:
        series_id = rows[0]['series_id']
    	rows = db((db.series_settings.series_id == series_id) & (db.series_settings.setting_name == 'title') & (db.series_settings.locale == locale)).select(db.series_settings.setting_value)
	if rows:
	    series_title=rows[0]['setting_value']
	rows = db((db.series_settings.series_id == series_id) & (db.series_settings.setting_name == 'subtitle') & (db.series_settings.locale == locale)).select(db.series_settings.setting_value)
        if rows:
            series_subtitle=rows[0]['setting_value']

    series_positions = {}
    order = []
    for i in submissions:
      if not i.submission_id in order:
	order.append(i.submission_id)
      series_position = db(db.submissions.submission_id == i.submission_id).select(db.submissions.series_position).first()['series_position']
      if series_position:
         subs.setdefault(i.submission_id, {})['series_position'] = series_position
	 pos_counter = 0
         try:
	   int_pos = int(series_position)
	   series_positions[i.submission_id] = int_pos
	 except:
	   series_positions[i.submission_id] = pos_counter
	   pos_counter += 1
      authors=''
      if i.setting_name == 'abstract':
          subs.setdefault(i.submission_id, {})['abstract'] = i.setting_value
      if i.setting_name == 'subtitle':
          subs.setdefault(i.submission_id, {})['subtitle'] = i.setting_value
      if i.setting_name == 'title':
          subs.setdefault(i.submission_id, {})[
              'title'] = i.setting_value
      author_q = ((db.authors.submission_id == i.submission_id))
      authors_list = db(author_q).select(
          db.authors.first_name, db.authors.last_name, db.authors.seq, orderby=db.authors.seq)
      for j in authors_list:
          authors += j.first_name + ' ' + j.last_name + ', '
      if authors.endswith(', '):
        authors = authors[:-2]
          
      subs.setdefault(i.submission_id, {})['authors'] = authors
      if series_positions != {}:
        order = [e[0] for e in sorted(series_positions.items(), key=itemgetter(1), reverse=True)]

    return dict(submissions=submissions, subs=subs, order=order, series_title=series_title, series_subtitle=series_subtitle)

def index():
    abstract, author, cleanTitle, subtitle = '', '', '', ''
    locale = 'de_DE'
    if session.forced_language == 'en':
        locale = 'en_US'
    ignored_submissions =  myconf.take('omp.ignore_submissions') if myconf.take('omp.ignore_submissions') else -1
    query = ((db.submissions.context_id == myconf.take('omp.press_id')) &  (db.submissions.submission_id!=ignored_submissions) & (db.submissions.status == 3) & (
        db.submission_settings.submission_id == db.submissions.submission_id) & (db.submission_settings.locale == locale))
    submissions = db(query).select(db.submission_settings.ALL,orderby=~db.submissions.date_submitted)
    subs = {}

    order = []
    for i in submissions:
      if not i.submission_id in order:
          order.append(i.submission_id)
      authors=''
      if i.setting_name == 'abstract':
          subs.setdefault(i.submission_id, {})['abstract'] = i.setting_value
      if i.setting_name == 'subtitle':
          subs.setdefault(i.submission_id, {})['subtitle'] = i.setting_value
      if i.setting_name == 'title':
          subs.setdefault(i.submission_id, {})[
              'title'] = i.setting_value
      author_q = ((db.authors.submission_id == i.submission_id))
      authors_list = db(author_q).select(
          db.authors.first_name, db.authors.last_name, db.authors.seq, orderby=db.authors.seq)
      for j in authors_list:
          authors += j.first_name + ' ' + j.last_name + ', '
      if authors.endswith(', '):
        authors = authors[:-2]
          
      subs.setdefault(i.submission_id, {})['authors'] = authors
    if len(subs) == 0:
      redirect( URL('home', 'index'))

    return locals()

def book():
    abstract, authors, cleanTitle, publication_format_settings_doi, press_name, subtitle = '', '', '', '', '', ''
    
    locale = ''
    if session.forced_language == 'en':
        locale = 'en_US'
    if session.forced_language == 'de':
        locale = 'de_DE'

    # Get submission id from request
    submission_id = request.args[0] if request.args else redirect(
        URL('home', 'index'))
    
    ompdal = OMPDAL(db, myconf)
    
    submission = ompdal.getPublishedSubmission(submission_id, press=myconf.take('omp.press_id'))    
    if not submission:
        redirect(URL('home', 'index'))
    
    settings = ompdal.getLocalizedSubmissionSettings(submission_id, locale)
    if not settings:
        settings = ompdal.getSubmissionSettings(submission_id)

    for st in settings:
        if st.setting_name == 'abstract':
            abstract = st.setting_value
        if st.setting_name == 'subtitle':
            subtitle = st.setting_value
        if st.setting_name == 'title':
            cleanTitle = st.setting_value
            
    chapters = ompdal.getLocalizedLatestRevisionOfChapters(submission_id, locale)
    if not chapters:
        chapters = ompdal.getLatestRevisionOfChapters(submission_id)
        
    authors = ompdal.getAuthors(submission_id)
    editors = ompdal.getEditors(submission_id)
    
    bio = {"editors": [ompdal.getLocalizedAuthorSettingValue(e.author_id, 'biography', locale) for e in editors],
           "authors": [ompdal.getLocalizedAuthorSettingValue(a.author_id, 'biography', locale) for a in authors]}
    
    # Publiction formats
    pdf = ompdal.getPublicationFormatByName(submission_id, myconf.take('omp.doi_format_name')).first()
    if pdf:
        doi = ompdal.getLocalizedPublicationFormatSettingValue(pdf.publication_format_id, "pub-id::doi", "")    # DOI always has empty locale
    else:
        doi = None

    pub_query = (db.publication_formats.submission_id == submission_id) & (db.publication_format_settings.publication_format_id == db.publication_formats.publication_format_id) & (
        db.publication_format_settings.locale == locale)

    publication_formats = db(pub_query & (db.publication_format_settings.setting_value != myconf.take('omp.ignore_format'))).select(db.publication_format_settings.setting_name, db.publication_format_settings.setting_value,
                                                                                                                                    db.publication_formats.publication_format_id, groupby=db.publication_formats.publication_format_id, orderby=db.publication_formats.publication_format_id)

    press_settings = db(db.press_settings.press_id == myconf.take('omp.press_id')).select(
        db.press_settings.setting_name, db.press_settings.setting_value)

    publication_format_settings = db((db.publication_format_settings.setting_name == 'name') & (db.publication_format_settings.locale == locale) & (db.publication_formats.submission_id == submission_id) & (
        db.publication_formats.publication_format_id == db.publication_format_settings.publication_format_id)).select(db.publication_format_settings.publication_format_id, db.publication_format_settings.setting_value)

    if publication_format_settings:
        publication_format_settings_doi = db((db.publication_format_settings.setting_name == 'pub-id::doi') & (db.publication_format_settings.publication_format_id == publication_format_settings.first(
        )['publication_format_id']) & (publication_format_settings.first()['setting_value'] == myconf.take('omp.doi_format_name'))).select(db.publication_format_settings.setting_value).first()

    identification_codes = {}
    identification_codes_publication_formats = db(
        db.publication_formats.submission_id == submission_id).select(
        db.publication_formats.publication_format_id)

    for i in identification_codes_publication_formats:
        name = db(
            (db.publication_format_settings.locale == locale) & (
                db.publication_format_settings.publication_format_id == i['publication_format_id']) & (
                db.publication_format_settings.setting_name == 'name') & (
                db.publication_format_settings.setting_value != myconf.take('omp.xml_category_name'))) .select(
                    db.publication_format_settings.setting_value).first()
        identification_code = db(
            (db.identification_codes.publication_format_id == i['publication_format_id']) & (
                db.identification_codes.code == 15)).select(
            db.identification_codes.value).first()
        if name and identification_code:
            identification_codes[
                identification_code['value']] = name['setting_value']

    date_pub_query =  (db.publication_formats.submission_id == submission_id) & (db.publication_format_settings.publication_format_id == db.publication_formats.publication_format_id)
    published_date = db(date_pub_query & (db.publication_format_settings.setting_value == myconf.take('omp.doi_format_name')) & (
        db.publication_dates.publication_format_id == db.publication_format_settings.publication_format_id)).select(db.publication_dates.date)

    representatives = db(
        (db.representatives.submission_id == submission_id) & (
            db.representatives.representative_id_type == myconf.take('omp.representative_id_type'))).select(
        db.representatives.name,
        db.representatives.url,
        orderby=db.representatives.representative_id)

    full_files = ompdal.getLatestRevisionsOfFullBook(submission_id)
    xml = ompdal.getPublicationFormatByName(submission_id, "XML")

    cover_image = ''
    path = request.folder+'static/monographs/'+submission_id+'/simple/cover.'
    for t in ['jpg','png','gif']:
        if os.path.exists(path+t):
                cover_image = URL(myconf.take('web.application'), 'static','monographs/' + submission_id + '/simple/cover.'+t)

    return locals()
