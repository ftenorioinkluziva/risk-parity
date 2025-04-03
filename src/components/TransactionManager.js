import React, { useState, useEffect } from 'react';

// Componente principal para gestão de transações com persistência no Supabase
const TransactionManager = () => {
  // Estados para armazenar os dados de transações e carteira
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Estados para o formulário
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    type: 'buy',
    asset: '',
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // Estado para tabs
  const [activeTab, setActiveTab] = useState('portfolio');
  
  // Lista de ativos disponíveis
  const [assets, setAssets] = useState([
    { id: 1, name: 'BOVA11 (Ibovespa)', ticker: 'BOVA11', currentPrice: 105.75 },
    { id: 2, name: 'PETR4 (Petrobras)', ticker: 'PETR4', currentPrice: 36.42 },
    { id: 3, name: 'XFIX11 (IFIX)', ticker: 'XFIX11', currentPrice: 92.15 },
    { id: 4, name: 'ITUB4 (Itaú)', ticker: 'ITUB4', currentPrice: 28.75 }
  ]);

  // Funções para comunicação com o Supabase
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/transacoes');
      
      if (!response.ok) {
        throw new Error('Falha ao buscar transações');
      }
      
      const data = await response.json();
      setTransactions(data);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar transações:', err);
      
      // Se a API falhar, carregamos dados de exemplo
      const mockTransactions = [
        { id: 1, type: 'buy', asset: 'BOVA11', quantity: 10, price: 98.50, date: '2023-01-15', totalValue: 985.00 },
        { id: 2, type: 'buy', asset: 'PETR4', quantity: 20, price: 32.75, date: '2023-02-20', totalValue: 655.00 },
        { id: 3, type: 'buy', asset: 'XFIX11', quantity: 5, price: 85.30, date: '2023-03-10', totalValue: 426.50 },
        { id: 4, type: 'sell', asset: 'BOVA11', quantity: 3, price: 104.20, date: '2023-05-05', totalValue: 312.60 }
      ];
      
      setTransactions(mockTransactions);
      setError('Não foi possível conectar ao servidor. Usando dados de demonstração.');
    } finally {
      setLoading(false);
    }
  };

  const saveTransaction = async (transaction) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/transacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
      });
      
      if (!response.ok) {
        throw new Error('Falha ao salvar transação');
      }
      
      const savedTransaction = await response.json();
      return savedTransaction;
    } catch (err) {
      console.error('Erro ao salvar transação:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Carregar transações ao montar o componente
  useEffect(() => {
    fetchTransactions();
    fetchAssets();
  }, []);

  // Simulação de busca de ativos
  const fetchAssets = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/ativos');
      
      if (response.ok) {
        const data = await response.json();
        
        // Transformar os dados para o formato usado pelo componente
        const formattedAssets = data.map(asset => ({
          id: asset.id,
          name: asset.nome,
          ticker: asset.ticker,
          currentPrice: asset.preco_atual
        }));
        
        setAssets(formattedAssets);
      }
    } catch (err) {
      console.error('Erro ao buscar ativos:', err);
      // Mantém os ativos de exemplo definidos no estado inicial
    }
  };
  
  // Funções auxiliares
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };
  
  // Cálculo da carteira com base nas transações
  const calculatePortfolio = () => {
    const portfolio = {};
    
    // Agrupar transações por ativo
    transactions.forEach(transaction => {
      if (!portfolio[transaction.asset]) {
        portfolio[transaction.asset] = {
          asset: transaction.asset,
          quantity: 0,
          totalInvestment: 0,
          averagePrice: 0
        };
      }
      
      const assetData = portfolio[transaction.asset];
      
      if (transaction.type === 'buy') {
        // Cálculo do preço médio para compras
        const oldValue = assetData.quantity * assetData.averagePrice;
        const newValue = transaction.quantity * transaction.price;
        const newQuantity = assetData.quantity + transaction.quantity;
        
        assetData.averagePrice = newQuantity > 0 ? (oldValue + newValue) / newQuantity : 0;
        assetData.quantity += transaction.quantity;
        assetData.totalInvestment += transaction.quantity * transaction.price;
      } else if (transaction.type === 'sell') {
        // Para vendas, reduz a quantidade
        assetData.quantity -= transaction.quantity;
        // Ajusta o valor investido
        if (assetData.quantity > 0) {
          assetData.totalInvestment = assetData.quantity * assetData.averagePrice;
        } else {
          assetData.quantity = 0;
          assetData.totalInvestment = 0;
        }
      }
      
      // Obter o preço atual
      const assetInfo = assets.find(a => a.ticker === transaction.asset);
      if (assetInfo) {
        assetData.currentPrice = assetInfo.currentPrice;
        assetData.currentValue = assetData.quantity * assetData.currentPrice;
        assetData.profit = assetData.currentValue - assetData.totalInvestment;
        assetData.profitPercentage = assetData.totalInvestment > 0 
          ? (assetData.profit / assetData.totalInvestment) * 100 
          : 0;
        assetData.name = assetInfo.name;
      }
    });
    
    // Filtrar ativos com quantidade > 0
    return Object.values(portfolio).filter(asset => asset.quantity > 0);
  };
  
  // Calcular totais da carteira
  const calculateTotals = (portfolio) => {
    const totalInvestment = portfolio.reduce((sum, asset) => sum + asset.totalInvestment, 0);
    const totalValue = portfolio.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalProfit = portfolio.reduce((sum, asset) => sum + asset.profit, 0);
    const profitPercentage = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    
    return { totalInvestment, totalValue, totalProfit, profitPercentage };
  };
  
  // Processar o formulário de nova transação
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Validar e adicionar nova transação
  const validateTransaction = () => {
    // Validação básica
    if (!formData.asset || !formData.quantity || !formData.price || !formData.date) {
      setError('Por favor, preencha todos os campos');
      return false;
    }
    
    const quantity = parseFloat(formData.quantity);
    const price = parseFloat(formData.price);
    
    if (quantity <= 0 || price <= 0) {
      setError('Quantidade e preço devem ser valores positivos');
      return false;
    }
    
    // Validar data
    const transactionDate = new Date(formData.date);
    const today = new Date();
    if (transactionDate > today) {
      setError('A data da transação não pode ser no futuro');
      return false;
    }
    
    // Se for venda, validar se há quantidade suficiente para vender
    if (formData.type === 'sell') {
      const portfolio = calculatePortfolio();
      const asset = portfolio.find(a => a.asset === formData.asset);
      
      if (!asset) {
        setError(`Você não possui ${formData.asset} para vender`);
        return false;
      }
      
      if (asset.quantity < quantity) {
        setError(`Você só possui ${asset.quantity} unidades de ${formData.asset}`);
        return false;
      }
    }
    
    return true;
  };
  
  // Adicionar nova transação
  const handleAddTransaction = async () => {
    if (!validateTransaction()) {
      return;
    }
    
    try {
      setLoading(true);
      
      const quantity = parseFloat(formData.quantity);
      const price = parseFloat(formData.price);
      
      // Criar nova transação
      const newTransaction = {
        type: formData.type,
        asset: formData.asset,
        quantity: quantity,
        price: price,
        date: formData.date,
        totalValue: quantity * price
      };
      
      // Tentar salvar no backend
      try {
        const savedTransaction = await saveTransaction(newTransaction);
        
        // Se salvar com sucesso, usa o ID retornado pelo servidor
        newTransaction.id = savedTransaction.id;
      } catch (err) {
        // Se falhar, gera um ID local
        newTransaction.id = Date.now();
        console.log('Falha ao salvar no servidor, usando ID local');
      }
      
      // Adicionar à lista de transações
      setTransactions(prev => [...prev, newTransaction]);
      
      // Exibir mensagem de sucesso
      setSuccess('Transação registrada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Resetar formulário
      setFormData({
        type: 'buy',
        asset: '',
        quantity: '',
        price: '',
        date: new Date().toISOString().split('T')[0]
      });
      
      // Esconder formulário
      setFormVisible(false);
      
      // Limpar erro
      setError(null);
    } catch (err) {
      setError('Erro ao processar transação. Por favor, tente novamente.');
      console.error('Erro ao processar transação:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Calcular carteira atual
  const portfolio = calculatePortfolio();
  const totals = calculateTotals(portfolio);
  
  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-2xl font-semibold text-gray-800">Gestão de Transações</h2>
        <p className="text-gray-600">Acompanhe sua carteira de investimentos</p>
      </div>
      
      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="m-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-center">
          <p>{error}</p>
          <button 
            className="text-red-700 font-bold hover:text-red-800 ml-2"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
      
      {success && (
        <div className="m-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4">
          <p>{success}</p>
        </div>
      )}
      
      {/* Tabs de navegação */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'portfolio'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('portfolio')}
          >
            Carteira
          </button>
          <button 
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeTab === 'transactions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('transactions')}
          >
            Transações
          </button>
        </nav>
      </div>
      
      <div className="p-4">
        {/* Indicador de carregamento */}
        {loading && (
          <div className="flex justify-center items-center h-12 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-blue-500">Carregando...</span>
          </div>
        )}
        
        {/* Botão de nova transação */}
        <div className="mb-4 flex justify-end">
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setFormVisible(!formVisible)}
            disabled={loading}
          >
            {formVisible ? 'Cancelar' : 'Nova Transação'}
          </button>
        </div>
        
        {/* Formulário de nova transação */}
        {formVisible && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-3">Nova Transação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
                >
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ativo <span className="text-red-500">*</span>
                </label>
                <select
                  name="asset"
                  value={formData.asset}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={loading}
                >
                  <option value="">Selecione um ativo</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.ticker}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded"
                  max={new Date().toISOString().split('T')[0]}
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
                  onClick={handleAddTransaction}
                  disabled={loading}
                >
                  {loading ? 'Processando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Conteúdo da tab de Carteira */}
        {activeTab === 'portfolio' && (
          <>
            {/* Cards de resumo */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">Valor Total</p>
                <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.totalValue)}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-800">Total Investido</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalInvestment)}</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.totalProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Lucro/Prejuízo
                </p>
                <p className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {formatCurrency(totals.totalProfit)}
                </p>
              </div>
              
              <div className={`p-4 rounded-lg border ${
                totals.profitPercentage >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
              }`}>
                <p className={`text-sm ${totals.profitPercentage >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  Rendimento
                </p>
                <p className={`text-2xl font-bold ${totals.profitPercentage >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {totals.profitPercentage.toFixed(2)}%
                </p>
              </div>
            </div>
            
            {/* Tabela de ativos */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Médio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Atual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lucro/Prejuízo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rendimento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {portfolio.length > 0 ? portfolio.map(asset => (
                    <tr key={asset.asset} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{asset.name || asset.asset}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {asset.quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {formatCurrency(asset.averagePrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {formatCurrency(asset.currentPrice)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(asset.currentValue)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        asset.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(asset.profit)}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        asset.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {asset.profitPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                        Nenhum ativo encontrado. Adicione transações para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        
        {/* Conteúdo da tab de Transações */}
        {activeTab === 'transactions' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ativo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length > 0 ? (
                  // Ordenar transações pela data, mais recentes primeiro
                  [...transactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(transaction => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type === 'buy' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {transaction.asset}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {transaction.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {formatCurrency(transaction.price)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                          {formatCurrency(transaction.totalValue)}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-4 text-center text-gray-500">
                      Nenhuma transação encontrada. Adicione transações para começar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionManager;