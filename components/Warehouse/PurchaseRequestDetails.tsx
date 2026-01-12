import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, ShoppingCart, Clock, AlertCircle, FileText, History } from 'lucide-react';
import { api } from '../../services/api';
import { PurchaseRequest, PurchaseRequestLogEntry } from '../../types';

interface PurchaseRequestDetailsProps {
  request: PurchaseRequest;
  onClose: () => void;
  onUpdate: () => void;
  hasPermission: (permission: string) => boolean;
}

export const PurchaseRequestDetails: React.FC<PurchaseRequestDetailsProps> = ({
  request: initialRequest,
  onClose,
  onUpdate,
  hasPermission,
}) => {
  const [request, setRequest] = useState<PurchaseRequest>(initialRequest);
  const [log, setLog] = useState<PurchaseRequestLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    loadRequestDetails();
    loadLog();
  }, [initialRequest.id]);

  const loadRequestDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getPurchaseRequest(initialRequest.id);
      setRequest(data);
    } catch (error) {
      console.error('Failed to load request details:', error);
      alert('Ошибка при загрузке деталей заявки');
    } finally {
      setLoading(false);
    }
  };

  const loadLog = async () => {
    try {
      const data = await api.getPurchaseRequestLog(initialRequest.id);
      setLog(data);
    } catch (error) {
      console.error('Failed to load log:', error);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Одобрить заявку?')) return;
    try {
      await api.approvePurchaseRequest(request.id);
      await loadRequestDetails();
      onUpdate();
      alert('Заявка одобрена');
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось одобрить заявку'));
    }
  };

  const handleReject = async () => {
    const reason = prompt('Укажите причину отклонения:');
    if (reason === null) return;
    try {
      await api.rejectPurchaseRequest(request.id, reason);
      await loadRequestDetails();
      onUpdate();
      alert('Заявка отклонена');
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось отклонить заявку'));
    }
  };

  const handleMoveToPurchase = async () => {
    const supplierId = prompt('ID поставщика (опционально):') || undefined;
    const responsiblePerson = prompt('ID ответственного (опционально):') || undefined;
    const plannedDate = prompt('Планируемая дата (YYYY-MM-DD, опционально):') || undefined;

    try {
      await api.movePurchaseRequestToPurchase(request.id, {
        supplierId,
        responsiblePerson,
        plannedDate,
      });
      await loadRequestDetails();
      onUpdate();
      alert('Заявка переведена в закупку');
    } catch (error: any) {
      alert('Ошибка: ' + (error.message || 'Не удалось перевести заявку'));
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      new: 'Новая',
      in_progress: 'В обработке',
      approved: 'Одобрена',
      purchased: 'Закуплено',
      rejected: 'Отклонена',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-architect-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-architect-900 dark:border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-architect-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-architect-800 border-b border-architect-200 dark:border-architect-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-architect-900 dark:text-white">
              Заявка {request.requestNumber}
            </h2>
            <p className="text-sm text-architect-500 dark:text-architect-400 mt-1">
              Создана {new Date(request.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-architect-100 dark:hover:bg-architect-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-architect-600 dark:text-architect-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Статус</label>
              <div className="mt-1">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {getStatusText(request.status)}
                </span>
                {request.needsReorder && (
                  <span className="ml-2 inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Требуется дозакупка
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Срочность</label>
              <div className="mt-1">
                {request.urgency === 'urgent' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Срочная
                  </span>
                ) : (
                  <span className="text-sm text-architect-600 dark:text-architect-300">Обычная</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Объект</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">{request.projectName || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Автор</label>
              <p className="mt-1 text-sm text-architect-900 dark:text-white">
                {request.createdByName || request.createdByEmail || '—'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-architect-500 dark:text-architect-400">Общая сумма</label>
              <p className="mt-1 text-lg font-bold text-architect-900 dark:text-white">
                {request.totalAmount.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            {request.estimateProjectId && (
              <div>
                <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                  Привязана к смете
                </label>
                <p className="mt-1 text-sm text-architect-900 dark:text-white">Да</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div>
            <h3 className="text-lg font-semibold text-architect-900 dark:text-white mb-4">Материалы</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-architect-50 dark:bg-architect-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Материал
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Запрошено
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Одобрено
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Закуплено
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Цена
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-architect-500 dark:text-architect-400">
                      Примечание
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-architect-200 dark:divide-architect-700">
                  {request.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-architect-900 dark:text-white">
                        {item.materialName || '—'}
                        {item.fromEstimate && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(из сметы)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-architect-600 dark:text-architect-300">
                        {item.quantityRequested} {item.materialUnit || 'шт'}
                      </td>
                      <td className="px-4 py-2 text-sm text-architect-600 dark:text-architect-300">
                        {item.quantityApproved !== null
                          ? `${item.quantityApproved} ${item.materialUnit || 'шт'}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-architect-600 dark:text-architect-300">
                        {item.quantityPurchased} {item.materialUnit || 'шт'}
                      </td>
                      <td className="px-4 py-2 text-sm text-architect-600 dark:text-architect-300">
                        {item.unitPrice ? `${item.unitPrice.toLocaleString('ru-RU')} ₽` : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-architect-600 dark:text-architect-300">
                        {item.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Purchase info */}
          {request.purchaseInfo && (
            <div className="border-t border-architect-200 dark:border-architect-700 pt-4">
              <h3 className="text-lg font-semibold text-architect-900 dark:text-white mb-4">
                Информация о закупке
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                    Поставщик
                  </label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">
                    {request.purchaseInfo.supplierName || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                    Планируемая дата
                  </label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">
                    {request.purchaseInfo.plannedDate
                      ? new Date(request.purchaseInfo.plannedDate).toLocaleDateString('ru-RU')
                      : '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                    Фактическая дата
                  </label>
                  <p className="mt-1 text-sm text-architect-900 dark:text-white">
                    {request.purchaseInfo.actualDate
                      ? new Date(request.purchaseInfo.actualDate).toLocaleDateString('ru-RU')
                      : '—'}
                  </p>
                </div>
                {request.purchaseInfo.documentUrl && (
                  <div>
                    <label className="text-sm font-medium text-architect-500 dark:text-architect-400">
                      Документ
                    </label>
                    <p className="mt-1">
                      <a
                        href={request.purchaseInfo.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Открыть документ
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-architect-200 dark:border-architect-700">
            {request.status === 'new' && hasPermission('approve_purchase_requests') && (
              <>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Одобрить
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Отклонить
                </button>
              </>
            )}
            {request.status === 'approved' && hasPermission('approve_purchase_requests') && (
              <button
                onClick={handleMoveToPurchase}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                В закупку
              </button>
            )}
            <button
              onClick={() => setShowLog(!showLog)}
              className="flex items-center gap-2 px-4 py-2 bg-architect-200 dark:bg-architect-700 text-architect-900 dark:text-white rounded-lg hover:bg-architect-300 dark:hover:bg-architect-600 transition-colors"
            >
              <History className="w-4 h-4" />
              История
            </button>
          </div>

          {/* Log */}
          {showLog && (
            <div className="border-t border-architect-200 dark:border-architect-700 pt-4">
              <h3 className="text-lg font-semibold text-architect-900 dark:text-white mb-4">Лог изменений</h3>
              <div className="space-y-2">
                {log.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-architect-50 dark:bg-architect-900 rounded-lg text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-architect-900 dark:text-white">{entry.action}</span>
                      <span className="text-architect-500 dark:text-architect-400">
                        {new Date(entry.performedAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-architect-600 dark:text-architect-300 mt-1">
                      {entry.performedByName || entry.performedByEmail}
                    </p>
                    {entry.comment && (
                      <p className="text-architect-500 dark:text-architect-400 mt-1">{entry.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
