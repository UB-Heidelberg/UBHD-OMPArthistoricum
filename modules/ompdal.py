# -*- coding: utf-8 -*-

class OMPDAL:
	"""
	A rudimentary database abstraction layer for the OMP database.
	"""
	def __init__(self, db, conf):
		self.db = db
		self.conf = conf

	def getAuthors(self, submission_id):
		"""
		Get all authors associated with the specified submission regardless of exact role.
		"""
		return self.db((self.db.authors.submission_id == submission_id)).select(
			self.db.authors.ALL,
			orderby=self.db.authors.seq
		)

	def getEditors(self, submission_id):
		"""
		Get all authors associated with the specified submission with editor role.
		"""
		try:
			editor_group_id = self.conf.take('omp.editor_id')
		except:
			return []
		return self.db((self.db.authors.submission_id == submission_id) 
			& (self.db.authors.user_group_id == editor_group_id)).select(
				self.db.authors.ALL,
				orderby=self.db.authors.seq
		)

	def getChapterAuthors(self, submission_id):
		"""
		Get all authors associated with the specified submission with chapter author role
		"""
		try:
			chapter_author_group_id = self.conf.take('omp.author_id')
		except:
			return []
		return self.db((self.db.authors.submission_id == submission_id) 
			& (self.db.authors.user_group_id == chapter_author_group_id)).select(
				self.db.authors.ALL,
				orderby=self.db.authors.seq
		)
			
	def getLocalizedAuthorSettingValue(self, author_id, setting_name, locale):
		q = ((self.db.author_settings.author_id == author_id)
				& (self.db.author_settings.locale == locale)
				& (self.db.author_settings.setting_name == setting_name)
			)
		res = self.db(q).select(self.db.author_settings.setting_value).first()
		if res:
			return res['setting_value']

	def getSubmission(self, submission_id):
		"""
		Get submission table row for a given id.
		"""
		return self.db.submissions[submission_id]
	
	def getPublishedSubmission(self, submission_id, press=None):
		"""
		Get submission table row for a given id, if the submission has been published.
		"""
		q = ((self.db.submissions.submission_id == submission_id)
			& (self.db.submissions.status == "3")
		)
		
		if press:
			q = ((self.db.submissions.submission_id == submission_id)
				& (self.db.submissions.status == "3")
				& (self.db.submissions.context_id == press)
			)
		
		return self.db(q).select(self.db.submissions.ALL)
	
	def getSubmissionSettings(self, submission_id):
		q = (self.db.submission_settings.submission_id == submission_id)
		
		return self.db(q).select(self.db.submission_settings.ALL)
	
	def getLocalizedSubmissionSettings(self, submission_id, locale):
		q = ((self.db.submission_settings.submission_id == submission_id)
        	& (self.db.submission_settings.locale == locale)
        )
		
		return self.db(q).select(self.db.submission_settings.ALL)

	def getSeries(self):
		"""
		Get series info.
		"""
		return self.db(self.db.series.press_id == self.conf.take("omp.press_id")).select(
			self.db.series.series_id,
			self.db.series.path,
			self.db.series.image
		)

	def getLocalizedSeriesSettings(self, series_id, locale):
		"""
		Get series settings for a given locale.
		"""
		ss = self.db.series_settings
		
		return self.db((ss.series_id == series_id) 
			& (ss.locale == locale)).select(
				ss.series_id,
				ss.locale,
				ss.setting_name,
				ss.setting_value
		)

	def getSeriesSettings(self, series_id):
		"""
		Get series settings.
		"""
		ss = self.db.series_settings
		
		return self.db(ss.series_id == series_id).select(
			ss.series_id,
			ss.locale,
			ss.setting_name,
			ss.setting_value
		)

	def getLocalizedChapters(self, submission_id, locale):
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

	def getChapters(self, submission_id):
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

	def getAllPublicationFormats(self, submission_id, available=True, approved=True):
		"""
		Get all publication formats for the given submission id.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved)
		)
		return self.db(q).select(pf.ALL)

	def getPhysicalPublicationFormats(self, submission_id, available=True, approved=True):
		"""
		Get all publication formats marked as physical format for the given submission id.
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
		Get all publication formats not marked as physical format for the given submission id.
		"""
		pf = self.db.publication_formats
		q = ((pf.submission_id == submission_id) 
			& (pf.is_available == available) 
			& (pf.is_approved == approved) 
			& (pf.physical_format == False)
		)
		return self.db(q).select(pf.ALL)

	def getPublicationFormatSettings(self, publication_format_id):
		pfs = self.db.publication_format_settings
		q = (pfs.submission_id == publication_format_id)
		return self.db(q).select(pfs.ALL)
	
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