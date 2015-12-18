# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''


def hst():
	return dict()

def index():
  series = db(db.series.press_id==myconf.take("omp.press_id") & (db.series.series_id==db.series_settings.series_id)).select(db.series.series_id, db.series_settings.image)
  return dict(series= series)
