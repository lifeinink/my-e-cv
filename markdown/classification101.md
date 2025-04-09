# Introduction
In order to apply learning from the Google ML Crash Course about logistic regression, data manging, and neural networks, I used the airlines dataset by [Elena Ikonomovska](https://kt.ijs.si/elena_ikonomovska/data.html) to predict whether airlines would be delayed or not.

This dataset is highly sequential but the initial experiments were performed without incorporating this into the features or models.
# Background
The dataset consists of around 539,383 examples of flights with the following features: airline, flight number, airport source, airport destination, time, day of week and the label delay which is 1 if the plane is delayed and 0 if it is not.
# Data Preparation
1. Data was scrubbed of 216,618 duplicates 
2. The range of data was inspected to identify outliers or classifications without enough instances to be represented at training.![[../images/airline_by_frequency.png]]The airports were left as is.
![[../images/flight_number_by_frequency.png]]
Flight numbers encoded no cardinal meaning and were too numerous to encode as one hot vectors given the size of the training dataset and so this column was discarded.
![[../images/flights_from_each_airport.png]] 
The long tail of airports from was clipped into an other category, with an additional feature to indicate whether the airport was categorised as other or not. ![[../images/clipped.png]] ![[../images/numerical_distributions.png]]
Initially the outliers to the left of the distribution of time were clipped, but upon visualising a combination of day and time it was found that the apparent outlier was part of the tail of the previous day. So in the versions of the dataset used in the model the data was not clipped.
![[../images/week_time_vs_flight_frequency.png]]
3. Numerical data was normalised. Based on the distributions of data, length was normalised via its z-score and time was normalised using linear scaling
![[../images/normalised_numerical_distributions.png]] 
This graph shows time as clipped, which it wasn't in the later processed datasets.
4. Categorical data was encoded as one-hot vectors.
# Feature Engineering
## Dataset One
The first dataset derived the frequency of flights at the source and destination locations at departure and arrival (departure + length) times as two features binned into 100 categories each. A cross product of each of these features with the source airport was made, and the airport traffic at small airports (determined before clipping to other) was encoded as a one hot vector. Time, length, day, airline information and non cross product airport information were removed from the dataset. This resulted in a little over 6000 features.
## Dataset Two
Consisted of airline, airport source, airport destination, time, day of week, and delay resulting in 470 features. This dataset has minimal data transformations because it would be used to compare a feature combining neural network with a simple logistic regression.

## Dataset Three
Similar to dataset two, but organised into a timeseries for each combination of day and source airport to allow for the training of a recurrent neural network
## Storage
Features were stored in the parquet format to save space because of their sparse nature.
# Models
## Logistic Regression
The first model type was a simple logistic regression: a linear regression followed by a sigmoid activation function.
```python
class Model(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(Model, self).__init__()
        self.linear = nn.Linear(input_dim, output_dim)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.linear(x)
        x = self.sigmoid(x)
        return x
```
## Simple Feed Forward Neural Network
The second model type was a FFNN, the model was pruned first by:
1. Starting with an oversized model: 3 hidden layers each 2/3 the size of the previous layer
2. Removing a layer at a time and retraining until performance dropped and then taking the previous model
3. Removing nodes until performance dropped etc.
The all layers except for the last layer used rectified linear units (ReLu) for the activation function to protect against vanishing gradients (not that the risk of that was large with the number of layers used). For protection against exploding gradients see the regularisation part of the training section of the mini-report. The output was then put through a sigmoid function as with the previous model.
```python
class NNetModel(nn.Module):
    def __init__(self, input_dim, hidden_dims, output_dim):
        super(NNetModel, self).__init__()
        layers = []
        self.hidden_activation = nn.ReLU()
        self.output_activation = nn.Sigmoid()
        layers.append(nn.Linear(input_dim, hidden_dims[0]))
        for i in range(1, len(hidden_dims)):
            layers.append(nn.Linear(hidden_dims[i-1], hidden_dims[i]))
        layers.append(nn.Linear(hidden_dims[-1], output_dim))
        self.fcs = nn.ModuleList(layers)

    def forward(self, x):
        for i in range(len(self.fcs)-1):
            x = self.fcs[i](x)
            x = self.hidden_activation(x)
        x = self.fcs[-1](x)
        x = self.output_activation(x)
        return x
```
## Recurrent Neural Network
The RNN model was trained in batches (rather than mini-batches, for adequate representation of airports) on timeseries of flights from particular airports for a particular day. Each epoch took far longer to evaluate for this model than the other models (2-2.5 minutes per epoch), and as a result the model had to be saved and reloaded in multiple training sessions, however the learning rate and regularisation rate weren't loaded, resulting in spikes in the loss curve for each restart of the training sessions as the optimiser readjusted hyperparameters.
```python
class RNNModel(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super(RNNModel, self).__init__()
        self.hidden_dim = hidden_dim
        self.rnn = nn.RNN(input_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, output_dim)
        self.sigmoid = nn.Sigmoid()
        self.relu = nn.ReLU()

    def forward(self, x):
        h0 = torch.zeros(1, 1, self.hidden_dim).to(x.device)
        x = x.unsqueeze(0)
        out, hn = self.rnn(x, h0)
        out = self.relu(out)
        out = self.fc(out)
        out = self.sigmoid(out)
        return out.squeeze(0)
```
# Training
- Data was shuffled and split into training (80%), validation (4%) and test (26%) sets.
- Used the Adam optimiser so that learning rates adjusted to each parameter.
- Binary cross entropy was used as the loss function.
- Each model was trained with and without L2 regularisation for comparison with the balance with the learning rate determined by trial and error.
- Model training stopped early when the model with the lowest loss on the validation data was found 100 iteration ago.
## Parallelisation
Due to the large number of examples and features training speed became the major bottleneck to troubleshooting. So the following measures were taken to speed up processing:
- OpenMP and MKL threads were set to the number of CPU cores. (They were not automatically assigned)
- Instead of shuffling in pandas data frames and converting to PyTorch tensors every epoch, the PyTorch data loader was used.
These measures cut epoch data prep time from around 30 seconds to sub second time and epoch training time from two minutes to around 45 seconds for dataset one.
# Results
Receiver operator curve was used because the label was relatively balanced.
## Dataset One Logistic Regressions
![[../images/naive_model_loss_curve.png]]
![[../images/regularised_model_loss_curve.png]]
![[../images/regularised_model_roc_curve.png]]
![[../images/naive_model_roc_curve.png]]
# Dataset Two Logistic Regression
![[../images/naive_model_loss_curve_1.png]] 
![[../images/regularised_model_loss_curve_1.png]]
![[../images/naive_model_roc_curve_1.png]]
![[../images/regularised_model_roc_curve_1.png]] 
## Dataset Two NNet Model
![[../images/nnet_model-naive_loss_curve.png]]!
![[../images/nnet_model-regularised_loss_curve_1.png]]
![[../images/nnet_model-naive_roc_curve.png]]
![[../images/nnet_model-regularised_roc_curve_1.png]]
## Dataset Three
![[../images/rnn_model_loss_curve.png]]
As discussed in the RNN section, the spikes in the loss curve represent moments when training was restarted and the optimiser had to find productive learning and regularisation rates. Training was stopped before convergence or early stopping criteria were met.
![[../images/rnn_model_roc_curve.png]]
# Discussion
- Spikes in the loss curves of the mini-batches indicate outliers
- Time to convergence was less for logistic regression with L2 regularisation compared to the naive model, but not for the FFNN. This may indicate a strong set of second order relationship preventing exploding gradients that couldn't guide gradient descent in the logistic regression models because of absent cross features in the second dataset. Faster convergence is expected with more parameters because of greater scalar differentials on average when each learning rate is attuned to each parameter (as is the case in the Adam optimiser). 
- Loss: RNN < FFNN < Regularised logistic regression on dataset 2 < Naive logistic regression on dataset 2 < Logistic regression on dataset 1, suggesting that business of an airport is a poor predictor, because it holds little correlation with the capacity of the airport, and that recent delays tend to predict current delays. This could be further elucidated with a correlation matrix between airport from frequency and delay frequency, and a distribution of delays over time at each particular airport.