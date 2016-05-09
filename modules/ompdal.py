# -*- coding: utf-8 -*-
'''
Copyright (c) 2015 Heidelberg University Library
Distributed under the GNU GPL v3. For full terms see the file
LICENSE.md
'''

class OMPSettings:
	def __init__(self, rows=[]):
		self._settings = dict()
		for row in rows:
			self._settings.setdefault(row.setting_name, {})[row.locale] = row.setting_value
			
	def getLocalizedValue(self, setting_name, locale, fallback="en_US"):
		if self._settings.has_key(setting_name):
			value = self._settings[setting_name].get(locale, "")
			if not value:
				value = self._settings[setting_name].get(fallback, "")
			return value
		else:
			return ""
		
	def getValues(self, setting_name):
		return self._settings.get(setting_name, {})
	
class OMPItem:
	def __init__(self, row, settings=OMPSettings(), associated_items={}):
		self.attributes = row
		self.settings = settings
		self.associated_items = associated_items

class OMPDAL:
	"""
	A rudimentary database abstraction layer for the OMP database.
	"""
	def __init__(self, db, conf):
		self.db = db
		self.conf = conf
		
	def getPress(self, press_id):
		"""
		Get row for a given press id.
		"""
		return self.db.presses[press_id]
	
	def getPressSettings(self, press_id):
		"""
		Get settings for a given press.
		"""
		ps = self.db.press_settings
		q = (ps.press_id == press_id)
		
		return self.db(q).select(ps.ALL)
	
	def getSubmission(self, submission_id):
		"""
		Get row for a given submission id.
		"""
		return self.db.submissions[submission_id]
	
	def getSubmissionsByPress(self, press_id, ignored_submission_id=-1, status=3):
		"""
		Get all submissions in press with the given status (default: 3=published).
		"""
		s = self.db.submissions
		q = ((s.context_id == press_id)
			& (s.submission_id != ignored_submission_id)
			& (s.status == status)
		)
		
		return self.db(q).select(s.ALL, orderby=~s.date_submitted)
	
	def getSubmissionsBySeries(self, series_id, ignored_submission_id=-1, status=3):
		"""
		Get all submissions in a series with the given status (default: 3=published).
		"""
		s = self.db.submissions
		q = ((s.series_id == series_id)
			& (s.submission_id != ignored_submission_id)
			& (s.status == status)
		)
		
		return self.db(q).select(s.ALL, orderby=~s.series_position)
	
	def getPublishedSubmission(self, submission_id, press_id=None):
		"""
		Get submission info for a given submission id, but only return, if the 
		submission has been published and is associated with a certain press. 
		"""
		s = self.db.submissions
		
		if press_id:
			q = ((s.submission_id == submission_id)
				& (s.status == "3")
				& (s.context_id == press_id)
			)
		else:
			q = ((s.submission_id == submission_id)
				& (s.status == "3")
			)
		
		return self.db(q).select(s.ALL).first()
	
	def getSubmissionSettings(self, submission_id):
		"""
		Get settings for a given submission.
		"""
		q = (self.db.submission_settings.submission_id == submission_id)
		
		return self.db(q).select(self.db.submission_settings.ALL)

	def getAuthorsBySubmission(self, submission_id):
		"""
		Get all authors associated with the specified submission regardless of their role.
		"""
		a = self.db.authors
		q = (a.submission_id == submission_id)
		
		return self.db(q).select(
			a.ALL,
			orderby=a.seq
		)
		
	def getChapterAuthorsBySubmission(self, submission_id):
		"""
		Get all authors associated with the specified submission with chapter author role.
		"""
		try:
			chapter_author_group_id = self.conf.take('omp.author_id')
		except:
			return []
		
		a = self.db.authors
		q = ((a.submission_id == submission_id) 
			& (a.user_group_id == chapter_author_group_id)
		)
		
		return self.db(q).select(
			self.db.authors.ALL,
			orderby=self.db.authors.seq
		)
			
	def getEditorsBySubmission(self, submission_id):
		"""
		Get all authors associated with the specified submission with editor role.
		"""
		try:
			editor_group_id = self.conf.take('omp.editor_id')
		except:
			return []
		
		a = self.db.authors
		q = ((a.submission_id == submission_id) 
			& (a.user_group_id == editor_group_id)
		)
		
		return self.db(q).select(
			self.db.authors.ALL,
			orderby=self.db.authors.seq
		)
		
	def getAuthorsByChapter(self, chapter_id):
		"""
		Get authors associated with a given chapter.
		"""
		sca = self.db.submission_chapter_authors
		a = self.db.authors
		q = ((sca.chapter_id == chapter_id)
			& (a.author_id == sca.author_id)
		)
		
		return self.db(q).select(a.ALL)
		
	def getAuthor(self, author_id):
		"""
		Get row for a given author id.
		"""
		return self.db.authors[author_id]
		
	def getAuthorSettings(self, author_id):
		"""
		Get settings for a given author.
		"""
		aus = self.db.author_settings
		q = (aus.author_id == author_id)
		
		return self.db(q).select(aus.ALL)
	
	def getUserSettings(self, user_id):
		us = self.db.user_settings
		q = (us.user_id == user_id)
		
		return self.db(q).select(us.ALL)
	
	def getSeriesByPress(self, press_id):
		"""
		Get all series published in the given press.
		"""
		s = self.db.series
		q = (s.press_id == press_id)
		
		return self.db(q).select(
			s.ALL
		)
		
	def getSeriesByPathAndPress(self, series_path, press_id):
		"""
		Get the series with the given pass in the given press (unique).
		"""
		s = self.db.series
		q = ((s.path == series_path) & (s.press_id == press_id))

		res = self.db(q).select(s.ALL)
		if res:
			return res.first()

	def getSeries(self, series_id):
		"""
		Get row for a given series id.
		"""
		return self.db.series[series_id]

	def getSeriesEditors(self, series_id):
		"""
		Get editors for the given series.
		"""
		return self.db(self.db.series_editors.press_id == self.conf.take("omp.press_id")
					   & (self.db.series_editors.user_id == self.db.users.user_id)).select(self.db.users.ALL)

	def getLocalizedSeriesSettings(self, series_id, locale):
		"""
		Get row for a given series id.
		"""
		return self.db.series[series_id]

	def getSeriesSettings(self, series_id):
		"""
		Get settings for a given series.
		"""
		ss = self.db.series_settings
		q = (ss.series_id == series_id)
		
		return self.db(q).select(ss.ALL)
	
	def getChaptersBySubmission(self, submission_id):
		"""
		Get all chapters associated with the given submission.
		"""
		sc = self.db.submission_chapters
		q = (sc.submission_id == submission_id)
		
		return self.db(q).select(
			sc.ALL,
			orderby=sc.chapter_seq
		)
		
	def getChapter(self, chapter_id):
		"""
		Get row for a given chapter id.
		"""
		return self.db.submission_chapters[chapter_id]
		
	def getChapterSettings(self, chapter_id):
		"""
		Get settings for a given chapter id.
		"""
		scs = self.db.submission_chapter_settings
		q = (scs.chapter_id == chapter_id)
		
		return self.db(q).select(scs.ALL)
	
	def getPublicationFormatsBySubmission(self, submission_id, available=True, approved=True):
		"""
		Get all approved and available publication formats for the given submission.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved)
		)
		
		return self.db(q).select(pf.ALL)
        
        def getAllPublicationFormatsBySubmission(self, submission_id, available=True, approved=True):
                """
            	Get all approved and available publication formats for the given submission.
            	"""
            	pf = self.db.publication_formats
            	q = (pf.submission_id == submission_id)
                
            	return self.db(q).select(pf.ALL)
    
	def getPhysicalPublicationFormats(self, submission_id, available=True, approved=True):
		"""
		Get all publication formats marked as physical format for the given submission.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved) 
			& (pf.physical_format == True)
		)
		
		return self.db(q).select(pf.ALL)

	def getDigitalPublicationFormats(self, submission_id, available=True, approved=True):
		"""
		Get all publication formats not marked as physical format for the given submission.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved) 
			& (pf.physical_format == False)
		)
		
		return self.db(q).select(pf.ALL)
	
	def getPublicationFormat(self, publication_format_id):
		"""
		Get row for a given publication format id.
		"""
		return self.db.publication_formats[publication_format_id]
	
	def getPublicationFormatByName(self, submission_id, name, available=True, approved=True):
		"""
		Get publication format for the given submission where any of the settings for 'name' matches the given string name. 
		"""
		pf = self.db.publication_formats
		pfs = self.db.publication_format_settings
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved) 
			& (pfs.publication_format_id == pf.publication_format_id) 
			& (pfs.setting_name == "name")
			& (pfs.setting_value == name)
		)
		return self.db(q).select(pf.ALL, groupby=pf.submission_id)

	def getPublicationFormatSettings(self, publication_format_id):
		"""
		Get settings for a given publication format id.
		"""
		pfs = self.db.publication_format_settings
		q = (pfs.publication_format_id == publication_format_id)
		
		return self.db(q).select(pfs.ALL)

	def getLatestRevisionOfChapterFileByPublicationFormat(self, chapter_id, publication_format_id):
		"""
		Get the latest revision of the file associated with a given chapter and publication format.
		"""
		sfs = self.db.submission_file_settings
		sf = self.db.submission_files
		
		q = ( (sfs.setting_name == "chapterID")
			& (sfs.setting_value == chapter_id)
			& (sf.file_id == sfs.file_id)
			& (sf.assoc_id == publication_format_id)
			& (sf.file_stage == 10)
		)
		
		res = self.db(q).select(sf.ALL, orderby=sf.revision)
		if res:
			return res.last()
	
	def getLatestRevisionOfFullBookFileByPublicationFormat(self, submission_id, publication_format_id):
		"""
		Get the latest revision of a file of genre "Book" for a given publication format.
		"""
		try:
			monograph_type_id = self.conf.take('omp.monograph_type_id')
		except:
			return []
		sf = self.db.submission_files
		q = ((sf.submission_id == submission_id)
			& (sf.genre_id == monograph_type_id)
			& (sf.file_stage == 10)
			& (sf.assoc_id == publication_format_id)
		)
		
		res= self.db(q).select(sf.ALL, orderby=sf.revision)
		if res:
			return res.last()

	def getPublicationDatesByPublicationFormat(self, publication_format_id):
		"""
		Get all publication dates associated with a given publication format.
		"""
		pd = self.db.publication_dates
		q = (pd.publication_format_id == publication_format_id)
		
		return self.db(q).select(pd.ALL)
	
	def getIdentificationCodesByPublicationFormat(self, publication_format_id):
		"""
		Get the identification codes (ISBN) associated with a given publication format.
		"""
		ic = self.db.identification_codes
		q = (ic.publication_format_id == publication_format_id)
		
		return self.db(q).select(ic.ALL)
	
	def getRepresentativesBySubmission(self, submission_id, representative_id):
		"""
		Get all representatives of a certain id for the given submission.
		"""
		r = self.db.representatives
		q = ((r.submission_id == submission_id)
			& (r.representative_id_type == representative_id)
		)		
		return self.db(q).select(r.ALL)
