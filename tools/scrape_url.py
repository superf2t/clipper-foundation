import scrape_logic

def main(urls):
    for url in urls:
        print url
        scrapers = scrape_logic.build_scrapers(url)
        for s in scrapers:
            print s.debug_string()

if __name__ == '__main__':
    import sys
    main(sys.argv[1:])
