/** @see https://zenn.dev/qnighy/articles/56917d9bf9077b#%E3%82%BF%E3%82%B0%E4%BB%98%E3%81%8D%E3%83%86%E3%83%B3%E3%83%97%E3%83%AC%E3%83%BC%E3%83%88%E3%83%AA%E3%83%86%E3%83%A9%E3%83%AB%E3%81%AE%E5%9E%8B%E5%AE%9F%E5%BC%95%E6%95%B0 */
/**
 * @template P
 * @param {  TemplateStringsArray  } texts
 * @param {  ...  (  function  (  P  )  :  string  )  } interpolation
 * @returns {  Interpolation  <  P  >  }
 */
function css(texts, ...interpolation) {
  /** @type {Interpolation<P>} */
  const i = [];
  texts.forEach((text, index) => {
    i.push(text);
    if (interpolation[index]) i.push(interpolation[index]);
  })
  return i;
}
