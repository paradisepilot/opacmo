library(calibrate)

summary_plot <- function(species) {
    xlabels = paste(tsv[tsv$Species==species,]$Gene.Symbol,
                tsv[tsv$Species==species,]$Service, sep='\n')
    
    name <- paste(species, "_tpr.png", sep="")
    png(filename = name, width=650, height=400, units="px", pointsize=10, bg="white")
    barplot(tsv[tsv$Species==species,]$True.Positive.Rate, ylim=c(0,1), names.arg=xlabels, col=colors, space=0.4)
    dev.off()
    
    name <- paste(species, "_fdr.png", sep="")
    png(filename = name, width=650, height=400, units="px", pointsize=10, bg="white")
    barplot(tsv[tsv$Species==species,]$False.Discovery.Rate, ylim=c(0,1), names.arg=xlabels, col=colors, space=0.4)
    dev.off()
}

tsv <- read.delim("opacmo_pubmed2ensembl56.tsv", header=T, stringsAsFactors=F)

x <- tsv[tsv$Species=='drosophila+melanogaster' & tsv$Gene.Symbol=='Myc',]
x$Gene.Symbol <- 'dm'
tsv[tsv$Species=='drosophila+melanogaster' & tsv$Gene.Symbol=='Myc',] <- x

colors = c('#5588bb', '#88aa33')

summary_plot('humans')
summary_plot('mice')
summary_plot('drosophila+melanogaster')
summary_plot('danio+rerio')

