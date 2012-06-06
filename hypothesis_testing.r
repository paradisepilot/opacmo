# Mann-Whitney-Wilcoxon test on the scores of two entities.

library('hash')

# pmcids <- read.delim('tmp/pmcids.tmp', header = FALSE, col.names = c('pmcid'), colClasses = c('character'))
dataset.1 <- read.delim('tmp/samples1.tmp', header = FALSE, col.names = c('pmcid', 'score'), colClasses = c('character', 'integer'))
dataset.2 <- read.delim('tmp/samples2.tmp', header = FALSE, col.names = c('pmcid', 'score'), colClasses = c('character', 'integer'))

pmcid.set <- unique(c(dataset.1$pmcid, dataset.2$pmcid))

dataset.1.per.pmcid <- hash(keys = pmcid.set, values = c(0))
dataset.2.per.pmcid <- hash(keys = pmcid.set, values = c(0))

for (row in 1:length(dataset.1$pmcid)) {
	dataset.1.per.pmcid[[ dataset.1$pmcid[row] ]] <- dataset.1$score[row]
}

for (row in 1:length(dataset.2$pmcid)) {
	dataset.2.per.pmcid[[ dataset.2$pmcid[row] ]] <- dataset.2$score[row]
}

paired.values.1 <- as.vector(values(dataset.1.per.pmcid, keys = pmcid.set))
paired.values.2 <- as.vector(values(dataset.2.per.pmcid, keys = pmcid.set))

wilcox.test(x = paired.values.1, y = paired.values.2, paired = TRUE)

cor(x = paired.values.1, y = paired.values.2)
cor(x = paired.values.1, y = paired.values.2, method = 'spearman')

pc <- princomp(data.frame(component.1 = paired.values.1, compoment.2 = paired.values.2), cor = TRUE)
summary(pc)

ks.test(x = paired.values.1, y = paired.values.2)

