import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Banner from "../../../components/app/Banner.jsx";

export default function HomeBannerRail({ banners=[],bannerRef,activeBanner,setActiveBanner,onScroll,onBannerClick }) {
  if (!banners.length) return null;
  return <section className="home-native-banners" aria-label="Ưu đãi tại Gánh">
    <div ref={bannerRef} onScroll={onScroll} className="home2026-banner-track no-scrollbar">
      {banners.map((banner,index)=><Banner key={banner.id} banner={banner} onClick={onBannerClick} priority={index===0} />)}
    </div>
    {banners.length>1 && <div className="home-banner-pagination" role="group" aria-label="Chọn banner">{banners.map((banner,index)=><CustomerControl key={banner.id} type="button" aria-label={`Banner ${index+1}`} aria-pressed={index===activeBanner} onClick={()=>{
      setActiveBanner(index);const track=bannerRef.current;track?.scrollTo({left:track.clientWidth*index,behavior:"smooth"});
    }}><span aria-hidden="true" /></CustomerControl>)}</div>}
  </section>;
}
