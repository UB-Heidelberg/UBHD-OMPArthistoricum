# -*- coding: utf-8 -*-

class Settings:
	def __init__(self, rows=[]):
		self._settings = dict()
		for row in rows:
			self._settings.setdefault(row.setting_name, {})[row.locale] = row.setting_value
			
	def getLocalizedValue(self, setting_name, locale):
		if self._settings.has_key(setting_name):
			return self._settings[setting_name].get(locale)
		else:
			return ""
		
	def getValues(self, setting_name):
		return self._settings.get(setting_name, "")
	
class Item:
	def __init__(self, row, settings=Settings(), associated_items=[]):
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
	
	def getPublishedSubmission(self, submission_id, press=None):
		"""
		Get submission info for a given submission id, but only return, if the 
		submission has been published and is associated with a certain press. 
		"""
		s = self.db.submissions
		
		if press:
			q = ((s.submission_id == submission_id)
				& (s.status == "3")
				& (s.context_id == press)
			)
		else:
			q = ((s.submission_id == submission_id)
				& (s.submissions.status == "3")
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
	
	def getSeriesByPress(self, press_id):
		"""
		Get all series published in the given press.
		"""
		s = self.db.series
		q = (s.press_id == press_id)
		
		return self.db(q).select(
			s.ALL
		)		

	def getSeries(self, series_id):
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
		Get all publication formats for the given submission.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved)
		)
		
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

	def getPublicationFormatSettings(self, publication_format_id):
		"""
		Get settings for a given publication format id.
		"""
		pfs = self.db.publication_format_settings
		q = (pfs.publication_format_id == publication_format_id)
		
		return self.db(q).select(pfs.ALL)

	def getChaptersWithLocalizedSettings(self, submission_id, locale):
		"""
		Get all chapters associated with the given submission and a given locale.
		"""
		sc = self.db.submission_chapters
		sfs = self.db.submission_file_settings
		
		q = ((sc.submission_id == submission_id) 
			& (sc.chapter_id == self.db.submission_chapter_settings.chapter_id)
			& (sfs.locale == locale)
			& (sfs.setting_name == "chapterID") 
			& (sfs.setting_value == sc.chapter_id) 
			& (sfs.file_id == self.db.submission_files.file_id) 
			& (self.db.submission_chapter_settings.setting_name == 'title')
		)

		return self.db(q).select(sc.chapter_id,
			self.db.submission_chapter_settings.setting_value,
			self.db.submission_files.ALL,
			orderby=[sc.chapter_seq, self.db.submission_files.assoc_id],
		)

	def getChaptersWithSettings(self, submission_id):
		"""
		Get all chapters associated with the given submission.
		"""
		sc = self.db.submission_chapters
		sfs = self.db.submission_file_settings
		
		q = ((sc.submission_id == submission_id)
			& (sc.chapter_id == self.db.submission_chapter_settings.chapter_id)
			& (sfs.setting_name == "chapterID")
			& (sfs.setting_value == sc.chapter_id)
			& (sfs.file_id == self.db.submission_files.file_id)
			& (self.db.submission_chapter_settings.setting_name == 'title')
		)

		return self.db(q).select(sc.chapter_id,
										self.db.submission_chapter_settings.setting_value,
										self.db.submission_files.ALL,
									orderby=[sc.chapter_seq, self.db.submission_files.assoc_id],
		)

	def getLocalizedLatestRevisionOfChapters(self, submission_id, locale):
		"""
		Get the latest revision for all chapter files associated with the given submission and a given locale.
		"""
		sc = self.db.submission_chapters
		sfs = self.db.submission_file_settings
		
		q = ((sc.submission_id == submission_id)
			& (sc.chapter_id == self.db.submission_chapter_settings.chapter_id)
			& (sfs.locale == locale)
			& (sfs.setting_name == "chapterID")
			& (sfs.setting_value == sc.chapter_id)
			& (sfs.file_id == self.db.submission_files.file_id)
			& (self.db.submission_chapter_settings.setting_name == 'title')
		)

		chapters = self.db(q).select(sc.chapter_id,
			self.db.submission_chapter_settings.setting_value,
			self.db.submission_files.ALL,
			orderby=[sc.chapter_seq, self.db.submission_files.assoc_id],
			distinct=True
		)
				
		latest_revision_chapters = []
		for row in chapters:
				latest_revision = self.db(self.db.submission_files.file_id == row.submission_files.file_id).select(self.db.submission_files.revision.max()).first()[self.db.submission_files.revision.max()]
				if row.submission_files.revision == latest_revision:
						latest_revision_chapters.append(row)

		return latest_revision_chapters

	def getLatestRevisionOfChapters(self, submission_id):
		"""
		Get the latest revision for all chapter files associated with the given submission.
		"""
		sc = self.db.submission_chapters
		sfs = self.db.submission_file_settings
		
		q = ((sc.submission_id == submission_id)
								& (sc.chapter_id == self.db.submission_chapter_settings.chapter_id)
								& (sfs.setting_name == "chapterID")
								& (sfs.setting_value == sc.chapter_id)
								& (sfs.file_id == self.db.submission_files.file_id)
								& (self.db.submission_chapter_settings.setting_name == 'title')
				)

		chapters = self.db(q).select(sc.chapter_id,
										self.db.submission_chapter_settings.setting_value,
										self.db.submission_files.ALL,
					orderby=[sc.chapter_seq, self.db.submission_files.assoc_id],
										distinct=True
		)
		
		latest_revision_chapters = []
		for row in chapters:
			latest_revision = self.db(self.db.submission_files.file_id == row.submission_files.file_id).select(self.db.submission_files.revision.max()).first()[self.db.submission_files.revision.max()]
			if row.submission_files.revision == latest_revision:
				latest_revision_chapters.append(row)

		return latest_revision_chapters
	
	def getLatestRevisionOfChapter(self, chapter_id, publication_format_id):
		sfs = self.db.submission_file_settings
		sf = self.db.submission_files
		
		q = ( (sfs.setting_name == "chapterID")
			& (sfs.setting_value == chapter_id)
			& (sf.file_id == sfs.file_id)
			& (sf.assoc_id == publication_format_id)
			& (sf.file_stage == 10)
		)
		
		return self.db(q).select(sf.ALL, orderby=~sf.revision, groupby=sf.revision).first()

	def getLatestRevisionsOfFullBook(self, submission_id):
		try:
			monograph_type_id = self.conf.take('omp.monograph_type_id')
		except:
			return []
		sf = self.db.submission_files
		q = ((sf.submission_id == submission_id)
						& (sf.genre_id == monograph_type_id)
						& (sf.file_stage > 5)
		)
		files = []
		for f in self.db(q).select(sf.file_id, orderby=sf.file_id, distinct=True):
			latest_revision = self.db(sf.file_id == f.file_id).select(sf.revision.max()).first()[sf.revision.max()]
			q_latest = ((sf.file_id == f.file_id)
				& (sf.revision == latest_revision)
					)
			files.append(self.db(q_latest).select(sf.ALL, orderby=sf.file_id, distinct=True).first())

		return files
	
	def getLatestRevisionOfFullBook(self, submission_id, publication_format_id):
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
		
		return self.db(q).select(sf.ALL, orderby=~sf.revision, groupby=sf.revision).first()

	def getPublicationDates(self, submission_id):
		q = ((self.db.publication_formats.submission_id == submission_id)
			& (self.db.publication_format_settings.publication_format_id == self.db.publication_formats.publication_format_id)
			& (self.db.publication_format_settings.setting_value == self.conf.take('omp.doi_format_name'))
			& (self.db.publication_dates.publication_format_id == self.db.publication_format_settings.publication_format_id)
		)
		return self.db(q).select(self.db.publication_dates.date,
			self.db.publication_dates.role,
			self.db.publication_dates.date_format
		)
	
	def getLocalizedPublicationFormatSettingValue(self, publication_format_id, setting_name, locale):
		pfs = self.db.publication_format_settings
		q = ((pfs.publication_format_id == publication_format_id)
				& (pfs.setting_name == setting_name)
				& (pfs.locale == locale)
			)
		res = self.db(q).select(pfs.setting_value).first()
		if res:
			return res['setting_value']

	def getLocalizedPublicationFormatSettings(self, publication_format_id, locale):
		pfs = self.db.publication_format_settings
		q = ((pfs.publication_format_id == publication_format_id) 
			& (pfs.locale == locale)
		)
		return self.db(q).select(pfs.ALL)

	def getPublicationFormatByName(self, submission_id, name, available=True, approved=True, locale=None):
		pf = self.db.publication_formats
		pfs = self.db.publication_format_settings
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved) 
			& (pfs.publication_format_id == pf.publication_format_id) 
			& (pfs.setting_name == "name") & (pfs.setting_value == name)
		)
		return self.db(q).select(pf.ALL, groupby=pf.submission_id)
	
	def getIdentificationCodesByPublicationFormat(self, publication_format_id):
		ic = self.db.identification_codes
		
		q = (ic.publication_format_id == publication_format_id)
		
		return self.db(q).select(ic.ALL)