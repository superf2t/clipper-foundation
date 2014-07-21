from scraping import article_parser

class DefaultArticleParser(article_parser.ArticleParser):
    TITLE_XPATH = './/h1'
