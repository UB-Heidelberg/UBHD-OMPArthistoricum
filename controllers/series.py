# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

from ompdal import OMPDAL, OMPSettings, OMPItem

def vmps_info():
    return dict()

def eva_info():
        return dict()

def dbae_info():
        return dict()

def palatium_info():
        return dict()

def index():
    if session.forced_language == 'en':
        locale = 'en_US'
    elif session.forced_language == 'de':
        locale = 'de_DE'
    else:
        locale = ''
        
    ompdal = OMPDAL(db, myconf)
    
    # Load press info from config
    press = ompdal.getPress(myconf.take('omp.press_id'))
    if not press:
        redirect(URL('home', 'index'))

    all_series = []
    for row in ompdal.getSeriesByPress(press.press_id):
        settings = OMPSettings(ompdal.getSeriesSettings(row.series_id))
        series = OMPItem(row, settings)
        series_editors = ompdal.getSeriesEditors(row.series_id)
        series.associated_items['editors'] = [OMPItem(e, OMPSettings(ompdal.getUserSettings(e.user_id))) for e in series_editors]
        all_series.append(series)
        
    all_series.sort(key=lambda s: s.settings.getLocalizedValue('title', locale))
    
    return locals()
