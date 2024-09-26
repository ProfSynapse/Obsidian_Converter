// src/hooks/useFileUpload.js
import { useState, useCallback } from 'react';

const useFileUpload = () => {
  const [items, setItems] = useState([]);

  const handleFileChange = useCallback((e) => {
    const newFiles = Array.from(e.target.files);
    setItems(prevItems => [
      ...prevItems, 
      ...newFiles.map(file => ({ type: 'file', content: file }))
    ]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files);
    setItems(prevItems => [
      ...prevItems, 
      ...newFiles.map(file => ({ type: 'file', content: file }))
    ]);
  }, []);

  const handleRemoveItem = useCallback((index) => {
    setItems(prevItems => prevItems.filter((_, i) => i !== index));
  }, []);

  return { items, setItems, handleFileChange, handleDrop, handleRemoveItem };
};

export default useFileUpload;
