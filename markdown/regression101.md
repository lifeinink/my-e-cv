# Introduction
Different regression models were tested on a diabetes dataset:
- Naive: all features used in model.
- Strong: all features with a correlation coefficient with the model above 0.2 are used.
- Significant: all features with a correlation coefficient greater than that of a random vector with the targets were included.
- Independent: all features from the significant model that's correlation with the target not explained by correlations with other factors exceeding that of a random vector with the targets were included. 
- Strong independent: all features with a correlation coefficient above 0.2 that were part of the independent model were included (in this case the features selected were identical to that of the independent  model)
# Results
## Naive
![[../images/naivetraining_loss_curve.png]]- Correlation coefficient: 0.13
- Scalar MSE sum: 10288.49
- Converged to 0.066 in 18 epochs
- age, sex, bmi, bp, s1, s2, s3, s4, s5, s6
## Strong
![[../images/strongtraining_loss_curve.png]]- Correlation coefficient: 0.59
- MSE sum: 6390.34
- Converged to 0.070 in 20 epochs
- bmi, bp, s3, s4, s5, s6
##  Significant
![[../images/significanttraining_loss_curve.png]]- Correlation coefficient: 0.38
- MSE sum: 6285.92
- Converged to 0.10 in 27 epochs
- age, bmp, bp ,s1, s2, s4, s5, s6
## Independent
![[../images/independanttraining_loss_curve.png]]- Correlation coefficient: 0.62
- MSE sum: 5794.86
- Converged to 0.084 in 25 epochs
- bmi, bp, s4, s5, 56
## Strong Independent
![[../images/strong_independenttraining_loss_curve.png]]- Correlation coefficient: 0.51
- MSE sum: 6023.85
- Converged to 0.060 in 18 epochs
- BMI, BP, s4, s5, s6
# Analysis
Jaggedness of descent may be due to:
- batch size needs to be larger
- learning rate ought to vary independently for each parameter
Loss in training vs loss in testing reveals:
- Naive: overfit
- Strong: overfit
- Significant: neutral
- Independent: underfit
- Strong independent: closest fit
The last two models should be the same in terms of fit because their features were the same. This comes down to variation in training. Bootstrapping models would be needed for a mor rigorious test.

Those models without s3 did not overfit. Results seem to follow the bias variance trade-off, with the "significant" model partially controlling for overfitting, and independence further controlling. However a dataset where there is a difference between independence and strong independence is needed to delineate between the benefits of each model and strict conclusions can't be drawn without statistical tests based on multiple models for each parameter combination.