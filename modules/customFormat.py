# -*- coding: utf-8 -*-

def formatAuthor(author):
    return " ".join([author.first_name, author.middle_name, author.last_name])

def formatAuthorCitationStyle(author):
    return "{}, {}".format(author.last_name, " ".join([author.first_name, author.middle_name]).strip())