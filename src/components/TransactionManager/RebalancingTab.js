// src/components/TransactionManager/RebalancingTab.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePortfolio } from '../../contexts/PortfolioContext';

const API_URL = 'http://localhost:5001/api';

const RebalancingTab = ({ showSuccessMessage, showErrorMessage }) => {
  const {
    portfolio,
    assets,
    formatCurrency
  } = usePortfolio();

  const [cestas, setCestas] = useState([]);
  const [selectedCesta, setSelectedCesta] = useState(null);
  const [rebalancingData, setRebalancingData] = useState([]);
  const [loadingCestas, setLoadingCestas] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  // Load user's baskets (cestas)
  useEffect(() => {
    const loadCestas = async () => {
      setLoadingCestas(true);
      try {
        const response = await axios.get(`${API_URL}/cestas`);
        setCestas(response.data);
        setLoadingCestas(false);
      } catch (error) {
        console.error('Error loading baskets:', error);
        showErrorMessage('Failed to load baskets. Please try again.');
        setLoadingCestas(false);
      }
    };

    loadCestas();
  }, [showErrorMessage]);

  // Calculate total portfolio value whenever portfolio changes
  useEffect(() => {
    const total = portfolio.reduce((sum, item) => sum + item.currentValue, 0);
    setTotalPortfolioValue(total);
  }, [portfolio]);

  // Handle basket selection
  const handleSelectCesta = (cesta) => {
    setSelectedCesta(cesta);
    calculateRebalancing(cesta);
  };

  // Calculate rebalancing based on selected basket
  const calculateRebalancing = (cesta) => {
    if (!cesta || !portfolio.length) return;

    // Calculate total percentage in the basket (should be 100% but let's confirm)
    // Note: We calculate this for validation purposes but don't need to use it directly
    Object.values(cesta.ativos).reduce((total, percent) => total + parseFloat(percent), 0);
    
    // Create rebalancing data for each portfolio asset
    const newRebalancingData = portfolio.map(asset => {
      const ticker = asset.asset.ticker;
      
      // Get the target percentage from the basket, defaulting to 0 if not found
      const targetPercentage = cesta.ativos[ticker] ? parseFloat(cesta.ativos[ticker]) : 0;
      
      // Calculate the target value based on total portfolio value
      const targetValue = (targetPercentage / 100) * totalPortfolioValue;
      
      // Calculate the target quantity
      const targetQuantity = targetValue / asset.currentPrice;
      
      // Calculate the difference in quantity (how many to buy/sell)
      const quantityDifference = targetQuantity - asset.quantity;
      
      // Calculate value difference
      const valueDifference = targetValue - asset.currentValue;
      
      // Calculate current percentage in portfolio
      const currentPercentage = (asset.currentValue / totalPortfolioValue) * 100;
      
      // Calculate percentage difference
      const percentageDifference = targetPercentage - currentPercentage;
      
      return {
        ...asset,
        targetPercentage,
        currentPercentage,
        percentageDifference,
        targetValue,
        valueDifference,
        targetQuantity,
        quantityDifference,
        roundedQuantityDifference: Math.round(quantityDifference)
      };
    });
    
    setRebalancingData(newRebalancingData);
  };

  // Format percentage for display
  const formatPercentage = (value) => {
    return `${value.toFixed(2)}%`;
  };

  // Display plus sign for positive numbers
  const formatWithSign = (value) => {
    return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
  };

  // Get color class based on value
  const getColorClass = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  // Determine if a rebalancing action is needed (threshold of 0.5%)
  const needsRebalancing = (difference) => {
    return Math.abs(difference) >= 0.5;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">Portfolio Rebalancing</h2>
        <p className="text-gray-600 mb-4">
          Select a basket model to calculate the adjustments needed to rebalance your portfolio according to the model's allocations.
        </p>
        
        {/* Basket selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Basket Model
          </label>
          
          {loadingCestas ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span>Loading baskets...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cestas.length > 0 ? (
                cestas.map(cesta => (
                  <div 
                    key={cesta.id}
                    onClick={() => handleSelectCesta(cesta)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCesta?.id === cesta.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="font-medium">{cesta.nome}</div>
                    <div className="text-xs text-gray-500">Created on {new Date(cesta.data_criacao).toLocaleDateString()}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(cesta.ativos)
                        .filter(([_, peso]) => parseFloat(peso) > 0)
                        .slice(0, 3)
                        .map(([ticker, peso]) => (
                          <span 
                            key={ticker} 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {ticker}: {parseFloat(peso).toFixed(0)}%
                          </span>
                        ))}
                      {Object.keys(cesta.ativos).filter(key => parseFloat(cesta.ativos[key]) > 0).length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          +{Object.keys(cesta.ativos).filter(key => parseFloat(cesta.ativos[key]) > 0).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-gray-500 text-center">No baskets found. Create a basket first to use rebalancing.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Selected basket summary */}
        {selectedCesta && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-2">{selectedCesta.nome}</h3>
            <p className="text-sm text-gray-600 mb-2">
              {selectedCesta.descricao || 'No description provided.'}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(selectedCesta.ativos)
                .filter(([_, peso]) => parseFloat(peso) > 0)
                .map(([ticker, peso]) => {
                  const asset = assets.find(a => a.ticker === ticker);
                  return (
                    <span 
                      key={ticker} 
                      className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800"
                    >
                      {asset ? asset.nome : ticker}: {parseFloat(peso).toFixed(1)}%
                    </span>
                  );
                })}
            </div>
            <div className="text-sm text-gray-600">
              Last updated: {new Date(selectedCesta.data_atualizacao).toLocaleString()}
            </div>
          </div>
        )}
        
        {/* Rebalancing calculations table */}
        {selectedCesta && rebalancingData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target %</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% Diff</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Target Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Change</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value Change</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rebalancingData.map(item => (
                  <tr key={item.ativo_id} className={`hover:bg-gray-50 ${
                    needsRebalancing(item.percentageDifference) ? 'bg-yellow-50' : ''
                  }`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.asset.nome}</div>
                      <div className="text-xs text-gray-500">{item.asset.ticker}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {formatPercentage(item.currentPercentage)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {formatPercentage(item.targetPercentage)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                      getColorClass(item.percentageDifference)
                    }`}>
                      {formatWithSign(item.percentageDifference)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {item.quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {item.targetQuantity.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                      getColorClass(item.quantityDifference)
                    }`}>
                      {formatWithSign(item.roundedQuantityDifference)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                      getColorClass(item.valueDifference)
                    }`}>
                      {formatCurrency(item.valueDifference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Instructions if rebalancing data is shown */}
        {selectedCesta && rebalancingData.length > 0 && (
          <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-md font-medium text-blue-800 mb-2">Rebalancing Instructions</h3>
            <p className="text-sm text-blue-700 mb-2">
              The table above shows the adjustments needed to rebalance your portfolio according to the selected model.
            </p>
            <ul className="list-disc pl-5 text-sm text-blue-600 space-y-1">
              <li>Positive values in the "Qty Change" column indicate shares to <strong>buy</strong></li>
              <li>Negative values indicate shares to <strong>sell</strong></li>
              <li>Highlighted rows (yellow background) indicate assets that need significant rebalancing (≥0.5% difference)</li>
            </ul>
          </div>
        )}
        
        {/* No portfolio data message */}
        {(!portfolio || portfolio.length === 0) && (
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="text-md font-medium text-yellow-800 mb-2">No Portfolio Data</h3>
            <p className="text-sm text-yellow-700">
              Your portfolio is empty. Add transactions to build your portfolio before using the rebalancing tool.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RebalancingTab;